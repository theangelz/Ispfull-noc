export type Protocol = "ssh" | "telnet";

export interface SshSession {
  id: string;
  path: string;
  name: string;
  folder: string;
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  protocol?: Protocol;
}

export interface ConnectionMetrics {
  bytesIn: number;
  bytesOut: number;
  connectedAt: number;
}

export interface IpcChannels {
  "ssh:connect": (sessionId: string) => Promise<{ ok: boolean; error?: string; pid?: string }>;
  "ssh:write": (pid: string, data: string) => void;
  "ssh:resize": (pid: string, cols: number, rows: number) => void;
  "ssh:close": (pid: string) => void;
  "inventory:load": () => Promise<SshSession[]>;
  "inventory:import-legacy": () => Promise<{ imported: number }>;
}
