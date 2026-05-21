import { useEffect, useState } from "react";
import {
  Server,
  Cpu,
  MemoryStick,
  Network,
  Clock,
  ArrowUpFromLine,
  ArrowDownToLine,
  Activity,
} from "lucide-react";
import { useStore } from "../store";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${sec}s`;
  return `${sec}s`;
}

function cpuColor(pct: number): string {
  if (pct >= 80) return "text-accent-red";
  if (pct >= 50) return "text-accent-yellow";
  return "text-accent-green";
}

export function StatusBar() {
  const { tabs, activeTabId } = useStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = tabs.find((t) => t.tabId === activeTabId);

  if (!active) {
    return (
      <div className="h-6 bg-[#0b0b0b] border-t border-border-soft flex items-center px-3 text-[10px] text-fg-dim font-mono">
        <Activity className="w-3 h-3 mr-1.5 text-fg-dim" />
        <span>pronto</span>
        <span className="ml-auto text-[#A6D8FF] font-semibold">
          {new Date(now).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  const uptime = active.connectedAt ? now - active.connectedAt : 0;
  const m = active.metrics;
  const memPct =
    m?.mem !== undefined && m?.memTotal && m.memTotal > 0
      ? Math.round((m.mem / m.memTotal) * 100)
      : undefined;

  return (
    <div className="h-6 bg-[#0b0b0b] border-t border-border-soft flex items-center px-3 text-[10px] text-fg-soft font-mono gap-4">
      <span className="flex items-center gap-1">
        <Server className="w-3 h-3 text-accent-cyan" />
        <span className="text-fg">{active.host}</span>
      </span>
      <span className="flex items-center gap-1">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            active.status === "connected"
              ? "bg-accent-green shadow-glow-green"
              : active.status === "error"
                ? "bg-accent-red"
                : "bg-accent-yellow"
          }`}
        />
        <span>{active.status}</span>
      </span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3 text-fg-dim" />
        <span>{formatUptime(uptime)}</span>
      </span>
      <span className="flex items-center gap-1">
        <ArrowDownToLine className="w-3 h-3 text-accent-green" />
        <span>{formatBytes(active.bytesIn)}</span>
      </span>
      <span className="flex items-center gap-1">
        <ArrowUpFromLine className="w-3 h-3 text-accent-blue" />
        <span>{formatBytes(active.bytesOut)}</span>
      </span>
      <span className="flex items-center gap-1" title={m?.cpu !== undefined ? "CPU do device" : "Aguardando dados do monitor"}>
        <Cpu className={`w-3 h-3 ${m?.cpu !== undefined ? cpuColor(m.cpu) : "text-fg-dim"}`} />
        <span className={m?.cpu !== undefined ? cpuColor(m.cpu) : "text-fg-dim"}>
          {m?.cpu !== undefined ? `${m.cpu}%` : "--"}
        </span>
      </span>
      <span className="flex items-center gap-1" title="Memória usada / total">
        <MemoryStick className={`w-3 h-3 ${memPct !== undefined ? cpuColor(memPct) : "text-fg-dim"}`} />
        <span className={memPct !== undefined ? cpuColor(memPct) : "text-fg-dim"}>
          {m?.mem !== undefined && m?.memTotal
            ? `${m.mem.toFixed(0)}/${m.memTotal.toFixed(0)} MB`
            : "--"}
        </span>
      </span>
      <span className="flex items-center gap-1" title="Tipo de device detectado">
        <Network className="w-3 h-3 text-fg-dim" />
        <span className="uppercase text-[9px]">{m?.device ?? "?"}</span>
      </span>
      <span className="ml-auto text-[#A6D8FF] font-semibold">
        {new Date(now).toLocaleTimeString()}
      </span>
    </div>
  );
}
