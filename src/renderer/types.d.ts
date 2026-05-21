import type { SshSession } from "../shared/types";

export interface AppSettings {
  colorizationEnabled: boolean;
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;
  monitorEnabled: boolean;
  monitorIntervalSec: number;
}

export interface DeviceMetrics {
  device: "ios" | "mikrotik" | "huawei" | "linux" | "unknown";
  cpu?: number;
  mem?: number;
  memTotal?: number;
}

interface SshApi {
  connect: (
    sessionId: string
  ) => Promise<{ ok: boolean; error?: string; pid?: string }>;
  write: (pid: string, data: string) => void;
  resize: (pid: string, cols: number, rows: number) => void;
  close: (pid: string) => void;
  reloadColors: () => Promise<number>;
  onData: (pid: string, cb: (data: string) => void) => () => void;
  onClose: (pid: string, cb: () => void) => () => void;
  onMetrics: (pid: string, cb: (m: DeviceMetrics) => void) => () => void;
}

export interface SessionFormData {
  name: string;
  folder: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  protocol?: "ssh" | "telnet";
}

interface InventoryApi {
  load: () => Promise<SshSession[]>;
  importLegacy: () => Promise<{ imported: number }>;
  create: (data: SessionFormData) => Promise<SshSession>;
  update: (
    data: SessionFormData & { id: string; clearPassword?: boolean }
  ) => Promise<SshSession | null>;
  delete: (id: string) => Promise<boolean>;
  renameFolder: (data: {
    oldFolder: string;
    newFolder: string;
  }) => Promise<number>;
  folders: () => Promise<string[]>;
}

interface SettingsApi {
  get: () => Promise<AppSettings>;
  save: (s: AppSettings) => Promise<boolean>;
}

export interface BackupBundle {
  version: 1;
  exportedAt: string;
  appVersion: string;
  sessions?: Array<SshSession & { password?: string }>;
  settings?: AppSettings;
  colorRules?: {
    ciscoWords: string | null;
    labHighlights: string | null;
  };
}

export interface ExportOptions {
  selectedSessionIds: string[];
  includePasswords: boolean;
  includeSettings: boolean;
  includeColorRules: boolean;
}

export interface ImportOptions {
  selectedSessionIds: string[];
  importPasswords: boolean;
  importSettings: boolean;
  importColorRules: boolean;
  mode: "merge" | "replace";
}

interface BackupApi {
  export: (
    options: ExportOptions
  ) => Promise<{ ok: boolean; path?: string; sessionCount?: number }>;
  preview: () => Promise<
    | null
    | { error: string }
    | { filePath: string; bundle: BackupBundle }
  >;
  apply: (
    bundle: BackupBundle,
    options: ImportOptions
  ) => Promise<{ ok: boolean; importedSessions: number }>;
}

interface UpdaterApi {
  check: () => Promise<{
    currentVersion: string;
    updateAvailable: boolean;
    version?: string;
    error?: string;
  }>;
  onDownloaded: (cb: () => void) => () => void;
}

export interface KeywordRule {
  id: string;
  pattern: string;
  color: string;
  bold: boolean;
  enabled: boolean;
  file: "Cisco Words.ini" | "Lab Highlights.ini";
}

interface KeywordsApi {
  load: () => Promise<KeywordRule[]>;
  save: (rules: KeywordRule[]) => Promise<boolean>;
}

interface NocApi {
  inventory: InventoryApi;
  settings: SettingsApi;
  ssh: SshApi;
  backup: BackupApi;
  updater: UpdaterApi;
  keywords: KeywordsApi;
}

declare global {
  interface Window {
    api: NocApi;
  }
}

export {};
