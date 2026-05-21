import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { app } from "electron";
import { fileURLToPath } from "node:url";

export interface ColorRule {
  pattern: string;
  r: number;
  g: number;
  b: number;
  bold: boolean;
}

const KW_FILES = ["Cisco Words.ini", "Lab Highlights.ini"];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Onde procurar os arquivos de keyword, em ordem de preferência:
// 1. userData/keywords/  → editável pelo user dentro da app
// 2. SecureCRT path no Mac (compat com setup do Renan)
// 3. resources/keywords/ bundled na app (default pra novos users)
function getKeywordSearchPaths(): string[] {
  const paths: string[] = [];
  try {
    paths.push(path.join(app.getPath("userData"), "keywords"));
  } catch {}
  if (process.platform === "darwin") {
    paths.push(
      path.join(
        os.homedir(),
        "Library/Application Support/VanDyke/SecureCRT/Config/Keywords"
      )
    );
  }
  // Bundled resources: em dev mode estão em resources/, em prod em process.resourcesPath
  const resourcesPath = (process as any).resourcesPath;
  if (resourcesPath) {
    paths.push(path.join(resourcesPath, "keywords"));
  }
  // Dev mode: dist-main/main/colorize.js → ../../resources/keywords
  paths.push(path.join(__dirname, "..", "..", "resources", "keywords"));
  return paths;
}

async function findKeywordFile(filename: string): Promise<string | null> {
  for (const dir of getKeywordSearchPaths()) {
    const candidate = path.join(dir, filename);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

function bgrToRgb(hexcolor: string): [number, number, number] {
  const v = parseInt(hexcolor, 16);
  const b = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const r = v & 0xff;
  return [r, g, b];
}

const LINE_RE =
  /^"((?:[^"\\]|\\.)*)",([0-9a-fA-F]{8}),([0-9a-fA-F]{8}),([0-9a-fA-F]{8})$/;

async function parseKeywordsFile(filepath: string | null): Promise<ColorRule[]> {
  const rules: ColorRule[] = [];
  if (!filepath) return rules;
  try {
    let raw = await fs.readFile(filepath, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // BOM
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s.startsWith('"')) continue;
      const m = s.match(LINE_RE);
      if (!m) continue;
      const [, regexStr, colHex, , enabledHex] = m;
      if (parseInt(enabledHex, 16) === 0) continue;
      if (regexStr.startsWith("[*]")) continue;
      if (regexStr === ".*|setasregextosetdefaultcolor") continue;
      const [r, g, b] = bgrToRgb(colHex);
      // Test that the regex compiles
      try {
        new RegExp(regexStr, "g");
      } catch {
        continue;
      }
      rules.push({ pattern: regexStr, r, g, b, bold: false });
    }
  } catch {
    /* file missing → empty */
  }
  return rules;
}

export async function loadColorRules(): Promise<ColorRule[]> {
  const all: ColorRule[] = [];
  for (const fn of KW_FILES) {
    const filepath = await findKeywordFile(fn);
    all.push(...(await parseKeywordsFile(filepath)));
  }
  return all;
}

export interface CompiledRule {
  re: RegExp;
  ansiPrefix: string;
}

const RESET = "\x1b[0m";
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

export function compileRules(rules: ColorRule[]): CompiledRule[] {
  const compiled: CompiledRule[] = [];
  for (const r of rules) {
    const wrapped = `(?<![A-Za-z0-9_])(?:${r.pattern})(?![A-Za-z0-9_])`;
    let re: RegExp;
    try {
      re = new RegExp(wrapped, "g");
    } catch {
      try {
        re = new RegExp(r.pattern, "g");
      } catch {
        continue;
      }
    }
    const ansiPrefix = `\x1b[${r.bold ? "1;" : ""}38;2;${r.r};${r.g};${r.b}m`;
    compiled.push({ re, ansiPrefix });
  }
  return compiled;
}

function colorizeLine(line: string, rules: CompiledRule[]): string {
  if (!line) return line;
  const n = line.length;
  const marked = new Uint8Array(n);

  // Reserva spans dentro de ANSI já presentes (não recolorir)
  ANSI_RE.lastIndex = 0;
  let am: RegExpExecArray | null;
  while ((am = ANSI_RE.exec(line))) {
    for (let i = am.index; i < am.index + am[0].length; i++) marked[i] = 1;
  }

  const spans: Array<[number, number, string]> = [];
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(line))) {
      const st = m.index;
      const en = st + m[0].length;
      if (st >= en) continue;
      let overlap = false;
      for (let i = st; i < en; i++) {
        if (marked[i]) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;
      spans.push([st, en, rule.ansiPrefix]);
      for (let i = st; i < en; i++) marked[i] = 1;
    }
  }
  if (spans.length === 0) return line;
  spans.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cur = 0;
  for (const [st, en, prefix] of spans) {
    if (st > cur) out += line.slice(cur, st);
    out += prefix + line.slice(st, en) + RESET;
    cur = en;
  }
  if (cur < n) out += line.slice(cur);
  return out;
}

// Chunk colorizer (stateless): para output já completo.
export function colorizeChunk(
  chunk: string,
  rules: CompiledRule[]
): string {
  if (!rules.length) return chunk;
  const parts = chunk.split(/(\r\n|\r|\n)/);
  let out = "";
  for (const p of parts) {
    if (p === "\r" || p === "\n" || p === "\r\n") {
      out += p;
    } else if (p.length > 0) {
      out += colorizeLine(p, rules);
    }
  }
  return out;
}

// Streaming colorizer com estado: mantém line buffer e repinta a linha em
// progresso a cada chunk via \r\x1b[K{colored}. Quando o remoto manda escape
// de cursor-movement ou backspace, marca dirty e pausa o overwrite até o
// próximo \r/\n (evita corromper edição no meio da linha).
const CSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

export interface StreamState {
  lineBuf: string;
  dirty: boolean;
}

export function newStreamState(): StreamState {
  return { lineBuf: "", dirty: false };
}

export function processStream(
  chunk: string,
  state: StreamState,
  rules: CompiledRule[]
): string {
  if (!rules.length) {
    // Sem regras: passa raw e só rastreia line buf pra futuro
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk.charCodeAt(i);
      if (c === 0x0a || c === 0x0d) state.lineBuf = "";
      else if (c === 0x08 || c === 0x7f) state.lineBuf = state.lineBuf.slice(0, -1);
      else state.lineBuf += chunk[i];
    }
    return chunk;
  }

  // Detecta cursor movement (CSI que não termina em 'm') ou backspace
  const hasEscape = chunk.indexOf("\x1b") >= 0;
  const hasBackspace = chunk.indexOf("\x08") >= 0;
  let hasMovement = hasBackspace;
  if (hasEscape) {
    CSI_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CSI_RE.exec(chunk))) {
      if (!m[0].endsWith("m")) {
        hasMovement = true;
        break;
      }
    }
  }

  if (hasEscape || hasBackspace) {
    // Passa o chunk raw — não tentamos repintar quando tem escapes
    if (hasMovement) state.dirty = true;
    // Atualiza line buf removendo ANSI
    const plain = chunk.replace(ANSI_RE, "");
    for (let i = 0; i < plain.length; i++) {
      const c = plain.charCodeAt(i);
      if (c === 0x0a || c === 0x0d) {
        state.lineBuf = "";
        state.dirty = false;
      } else if (c === 0x08 || c === 0x7f) {
        state.lineBuf = state.lineBuf.slice(0, -1);
      } else {
        state.lineBuf += plain[i];
      }
    }
    return chunk;
  }

  // Chunk limpo: emite raw byte-a-byte + acumula line buf
  // No fim, se line_buf não estiver dirty, repinta a linha colorida.
  let out = "";
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i];
    const c = chunk.charCodeAt(i);
    if (c === 0x0a) {
      if (state.lineBuf && !state.dirty) {
        out += "\r\x1b[K" + colorizeLine(state.lineBuf, rules);
      }
      out += "\n";
      state.lineBuf = "";
      state.dirty = false;
    } else if (c === 0x0d) {
      if (state.lineBuf && !state.dirty) {
        out += "\r\x1b[K" + colorizeLine(state.lineBuf, rules);
      }
      out += "\r";
      state.lineBuf = "";
      state.dirty = false;
    } else {
      out += ch;
      state.lineBuf += ch;
    }
  }
  // Repinta o tail da linha em progresso (digitação ao vivo)
  if (state.lineBuf && !state.dirty) {
    out += "\r\x1b[K" + colorizeLine(state.lineBuf, rules);
  }
  return out;
}
