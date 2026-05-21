import type React from "react";
import { create } from "zustand";
import type { SshSession } from "../shared/types";
import type { AppSettings, DeviceMetrics } from "./types";

export interface OpenTab {
  tabId: string;
  sessionId: string;
  pid: string | null;
  name: string;
  host: string;
  status: "connecting" | "connected" | "error" | "closed";
  error?: string;
  bytesIn: number;
  bytesOut: number;
  connectedAt: number;
  metrics?: DeviceMetrics;
}

interface StoreState {
  sessions: SshSession[];
  setSessions: (s: SshSession[]) => void;
  tabs: OpenTab[];
  activeTabId: string | null;
  openTab: (sess: SshSession) => Promise<void>;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, patch: Partial<OpenTab>) => void;
  addBytesIn: (tabId: string, n: number) => void;
  addBytesOut: (tabId: string, n: number) => void;
  setMetrics: (tabId: string, m: DeviceMetrics) => void;
  settings: AppSettings | null;
  setSettings: (s: AppSettings) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  sidebarSearchRef: React.RefObject<HTMLInputElement> | null;
  setSidebarSearchRef: (r: React.RefObject<HTMLInputElement>) => void;
  sessionForm: {
    mode: "new" | "edit";
    session: SshSession | null;
    presetFolder?: string;
  } | null;
  openSessionForm: (mode: "new" | "edit", session?: SshSession, presetFolder?: string) => void;
  closeSessionForm: () => void;
  reloadSessions: () => Promise<void>;
  keywordEditorOpen: boolean;
  setKeywordEditorOpen: (v: boolean) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  sessions: [],
  setSessions: (s) => set({ sessions: s }),
  tabs: [],
  activeTabId: null,
  openTab: async (sess) => {
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTab: OpenTab = {
      tabId,
      sessionId: sess.id,
      pid: null,
      name: sess.name,
      host: sess.host,
      status: "connecting",
      bytesIn: 0,
      bytesOut: 0,
      connectedAt: Date.now(),
    };
    set({ tabs: [...get().tabs, newTab], activeTabId: tabId });

    const result = await window.api.ssh.connect(sess.id);
    if (!result.ok || !result.pid) {
      get().updateTab(tabId, { status: "error", error: result.error });
      return;
    }
    get().updateTab(tabId, { pid: result.pid, status: "connected" });
  },
  closeTab: (tabId) => {
    const tab = get().tabs.find((t) => t.tabId === tabId);
    if (tab?.pid) window.api.ssh.close(tab.pid);
    const remaining = get().tabs.filter((t) => t.tabId !== tabId);
    let next = get().activeTabId;
    if (next === tabId) next = remaining[remaining.length - 1]?.tabId ?? null;
    set({ tabs: remaining, activeTabId: next });
  },
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  updateTab: (tabId, patch) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.tabId === tabId ? { ...t, ...patch } : t)),
    })),
  addBytesIn: (tabId, n) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.tabId === tabId ? { ...t, bytesIn: t.bytesIn + n } : t
      ),
    })),
  addBytesOut: (tabId, n) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.tabId === tabId ? { ...t, bytesOut: t.bytesOut + n } : t
      ),
    })),
  setMetrics: (tabId, m) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.tabId === tabId ? { ...t, metrics: m } : t
      ),
    })),
  settings: null,
  setSettings: (s) => set({ settings: s }),
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  sidebarSearchRef: null,
  setSidebarSearchRef: (r) => set({ sidebarSearchRef: r }),
  sessionForm: null,
  openSessionForm: (mode, session, presetFolder) =>
    set({ sessionForm: { mode, session: session ?? null, presetFolder } }),
  closeSessionForm: () => set({ sessionForm: null }),
  reloadSessions: async () => {
    const s = await window.api.inventory.load();
    set({ sessions: s });
  },
  keywordEditorOpen: false,
  setKeywordEditorOpen: (v) => set({ keywordEditorOpen: v }),
}));
