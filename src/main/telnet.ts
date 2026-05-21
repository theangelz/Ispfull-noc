import net from "node:net";
import { EventEmitter } from "node:events";

// Telnet IAC byte codes
const IAC = 0xff;
const DONT = 0xfe;
const DO = 0xfd;
const WONT = 0xfc;
const WILL = 0xfb;
const SB = 0xfa;
const SE = 0xf0;

const OPT_ECHO = 0x01;
const OPT_SGA = 0x03; // suppress go-ahead
const OPT_TTYPE = 0x18; // terminal type
const OPT_NAWS = 0x1f; // negotiate about window size

export interface TelnetOptions {
  host: string;
  port: number;
  termType?: string;
  cols?: number;
  rows?: number;
  timeoutMs?: number;
}

export class TelnetClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private cols: number;
  private rows: number;
  private termType: string;

  constructor(private opts: TelnetOptions) {
    super();
    this.cols = opts.cols ?? 80;
    this.rows = opts.rows ?? 24;
    this.termType = opts.termType ?? "xterm-256color";
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(
        { host: this.opts.host, port: this.opts.port, timeout: this.opts.timeoutMs ?? 15000 },
        () => {
          this.emit("ready");
          resolve();
        }
      );
      this.socket = socket;

      socket.on("data", (chunk: Buffer) => {
        const payload = this.processIncoming(chunk);
        if (payload.length > 0) this.emit("data", payload);
      });
      socket.on("close", () => {
        this.emit("close");
      });
      socket.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });
      socket.on("timeout", () => {
        socket.destroy();
        const err = new Error("telnet connect timeout");
        this.emit("error", err);
        reject(err);
      });
    });
  }

  write(data: string | Buffer): void {
    if (!this.socket) return;
    // Escape IAC (0xFF) → IAC IAC dentro de dados
    const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const out: number[] = [];
    for (const b of buf) {
      if (b === IAC) out.push(IAC, IAC);
      else out.push(b);
    }
    this.socket.write(Buffer.from(out));
  }

  setWindow(rows: number, cols: number): void {
    this.rows = rows;
    this.cols = cols;
    if (!this.socket) return;
    // IAC SB NAWS width(2) height(2) IAC SE
    const buf = Buffer.from([
      IAC, SB, OPT_NAWS,
      (cols >> 8) & 0xff, cols & 0xff,
      (rows >> 8) & 0xff, rows & 0xff,
      IAC, SE,
    ]);
    this.socket.write(buf);
  }

  end(): void {
    if (this.socket) {
      try { this.socket.end(); } catch {}
      this.socket = null;
    }
  }

  // Processa stream de bytes vindos do servidor, respondendo IAC negotiation
  // e retornando só os bytes de payload "limpos" pra emitir como dados.
  private negBuf: number[] = []; // buffer de bytes em meio a negociação
  private inNeg = false;
  private subBuf: number[] = [];
  private inSub = false;

  private processIncoming(chunk: Buffer): Buffer {
    const out: number[] = [];
    for (const b of chunk) {
      if (this.inSub) {
        // Acumula até IAC SE
        if (this.subBuf.length > 0 && this.subBuf[this.subBuf.length - 1] === IAC && b === SE) {
          this.subBuf.pop();
          this.handleSubnegotiation(this.subBuf);
          this.subBuf = [];
          this.inSub = false;
        } else {
          this.subBuf.push(b);
        }
        continue;
      }
      if (this.inNeg) {
        this.negBuf.push(b);
        if (this.negBuf.length === 2) {
          // [cmd, opt]
          const [cmd, opt] = this.negBuf;
          this.handleNegotiation(cmd, opt);
          this.negBuf = [];
          this.inNeg = false;
        }
        continue;
      }
      if (b === IAC) {
        // próximo é cmd ou SB ou IAC (data escape)
        // Peek isn't possible; use mini state machine via single-byte flag
        this.inNeg = true;
        this.negBuf = [];
        continue;
      }
      out.push(b);
    }
    // Lida com IAC IAC (escape): se neg veio com cmd=IAC, é byte literal 0xFF
    return Buffer.from(out);
  }

  private handleNegotiation(cmd: number, opt: number): void {
    if (!this.socket) return;
    if (cmd === SB) {
      this.inSub = true;
      this.subBuf = [opt]; // primeiro byte do subnegotiation é a opção
      return;
    }
    if (cmd === IAC) {
      // IAC IAC = byte literal 0xFF — mas já consumimos o segundo, então emit
      this.emit("data", Buffer.from([IAC]));
      return;
    }
    let resp: number | null = null;
    if (cmd === DO) {
      // Aceita: SGA, NAWS, TTYPE
      if (opt === OPT_SGA || opt === OPT_NAWS || opt === OPT_TTYPE) resp = WILL;
      else resp = WONT;
    } else if (cmd === DONT) {
      resp = WONT;
    } else if (cmd === WILL) {
      // Aceita servidor fazer ECHO e SGA
      if (opt === OPT_ECHO || opt === OPT_SGA) resp = DO;
      else resp = DONT;
    } else if (cmd === WONT) {
      resp = DONT;
    }
    if (resp !== null) {
      this.socket.write(Buffer.from([IAC, resp, opt]));
      // Se aceitamos TTYPE/NAWS, manda spontaneous subneg
      if (resp === WILL && opt === OPT_NAWS) {
        this.setWindow(this.rows, this.cols);
      }
    }
  }

  private handleSubnegotiation(buf: number[]): void {
    if (buf.length === 0 || !this.socket) return;
    const opt = buf[0];
    if (opt === OPT_TTYPE && buf[1] === 0x01) {
      // SEND: responde com nosso TTYPE
      const ttypeBytes = Buffer.from(this.termType, "ascii");
      const resp = Buffer.concat([
        Buffer.from([IAC, SB, OPT_TTYPE, 0x00]),
        ttypeBytes,
        Buffer.from([IAC, SE]),
      ]);
      this.socket.write(resp);
    }
  }
}
