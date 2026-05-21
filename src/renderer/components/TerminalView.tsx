import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useStore, type OpenTab } from "../store";

const THEME = {
  background: "#050505",
  foreground: "#d6d6d6",
  cursor: "#00d9ff",
  cursorAccent: "#050505",
  selectionBackground: "rgba(0, 191, 255, 0.25)",
  black: "#0f0f0f",
  red: "#ff4d4d",
  green: "#5cff72",
  yellow: "#ffd83d",
  blue: "#00bfff",
  magenta: "#ff7ad9",
  cyan: "#00d9ff",
  white: "#d6d6d6",
  brightBlack: "#5a5a5a",
  brightRed: "#ff7878",
  brightGreen: "#9bff9b",
  brightYellow: "#ffe784",
  brightBlue: "#5ed1ff",
  brightMagenta: "#ffafe8",
  brightCyan: "#79ecff",
  brightWhite: "#ffffff",
};

export function TerminalView({ tab, isActive = true }: { tab: OpenTab; isActive?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { addBytesIn, addBytesOut, updateTab, setMetrics, settings } = useStore();

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      fontFamily: `"${settings?.fontFamily ?? "JetBrains Mono"}", "Fira Code", monospace`,
      fontSize: settings?.fontSize ?? 13,
      lineHeight: 1.15,
      letterSpacing: 0,
      cursorBlink: settings?.cursorBlink ?? true,
      cursorStyle: "block",
      scrollback: settings?.scrollback ?? 10000,
      theme: THEME,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    term.write(`\x1b[36m→ Conectando a ${tab.host}...\x1b[0m\r\n`);

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {}
      if (tab.pid && termRef.current) {
        window.api.ssh.resize(tab.pid, term.cols, term.rows);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tab.pid || !termRef.current) return;
    const term = termRef.current;

    // Acumula bytes em refs e flush periódico — evita re-render por keystroke
    let pendingIn = 0;
    let pendingOut = 0;
    const flush = setInterval(() => {
      if (pendingIn > 0) {
        addBytesIn(tab.tabId, pendingIn);
        pendingIn = 0;
      }
      if (pendingOut > 0) {
        addBytesOut(tab.tabId, pendingOut);
        pendingOut = 0;
      }
    }, 500);

    const offData = window.api.ssh.onData(tab.pid, (data) => {
      term.write(data);
      pendingIn += data.length;
    });
    const offClose = window.api.ssh.onClose(tab.pid, () => {
      term.write("\r\n\x1b[31m[sessão encerrada]\x1b[0m\r\n");
      updateTab(tab.tabId, { status: "closed" });
    });
    const offMetrics = window.api.ssh.onMetrics(tab.pid, (m) => {
      setMetrics(tab.tabId, m);
    });

    const sub = term.onData((data) => {
      if (!tab.pid) return;
      window.api.ssh.write(tab.pid, data);
      pendingOut += data.length;
    });

    if (fitRef.current) {
      fitRef.current.fit();
      window.api.ssh.resize(tab.pid, term.cols, term.rows);
    }
    term.focus();

    return () => {
      clearInterval(flush);
      offData();
      offClose();
      offMetrics();
      sub.dispose();
    };
  }, [tab.pid]);

  useEffect(() => {
    if (tab.status === "error" && termRef.current) {
      termRef.current.write(
        `\r\n\x1b[31m✖ erro: ${tab.error ?? "desconhecido"}\x1b[0m\r\n`
      );
    }
  }, [tab.status, tab.error]);

  // Quando a tab fica ativa: refita e sincroniza tamanho com o remoto + foca.
  // Fix do bug "primeira tab quebra ao abrir segunda".
  useEffect(() => {
    if (!isActive || !termRef.current || !fitRef.current) return;
    try {
      fitRef.current.fit();
    } catch {}
    if (tab.pid) {
      window.api.ssh.resize(tab.pid, termRef.current.cols, termRef.current.rows);
    }
    termRef.current.focus();
  }, [isActive, tab.pid]);

  return <div className="h-full w-full bg-bg-main" ref={containerRef} />;
}
