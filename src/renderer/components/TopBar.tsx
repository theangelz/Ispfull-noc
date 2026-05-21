import {
  Terminal,
  FolderOpen,
  Network,
  Globe,
  RotateCw,
  Activity,
  Database,
  Settings as SettingsIcon,
  HelpCircle,
} from "lucide-react";
import { useStore } from "../store";

export function TopBar() {
  const {
    tabs,
    activeTabId,
    closeTab,
    sidebarSearchRef,
    setSettingsOpen,
  } = useStore();
  const activeTab = tabs.find((t) => t.tabId === activeTabId);

  const focusSearch = () => sidebarSearchRef?.current?.focus();
  const openSettings = () => setSettingsOpen(true);
  const closeCurrentTab = () => {
    if (activeTabId) closeTab(activeTabId);
  };
  const aboutBox = () => {
    alert(
      "SJNET NOC v0.1\nPremium SSH client para engenharia de rede\n\nDbl-click numa sessão da sidebar para abrir.\nCmd+, abre Settings."
    );
  };

  const MENUS: Array<{ label: string; onClick: () => void }> = [
    { label: "Sessions", onClick: focusSearch },
    { label: "Close Tab", onClick: closeCurrentTab },
    { label: "Settings", onClick: openSettings },
    { label: "Reload Colors", onClick: async () => {
      const n = await window.api.ssh.reloadColors();
      alert(`Cores recarregadas: ${n} regras`);
    }},
    { label: "Help", onClick: aboutBox },
  ];

  const TOOLS: Array<{
    icon: typeof Terminal;
    label: string;
    color: string;
    onClick: () => void;
  }> = [
    { icon: Terminal, label: "SSH (Quick Connect)", color: "text-accent-cyan", onClick: focusSearch },
    { icon: FolderOpen, label: "Sessões", color: "text-accent-orange", onClick: focusSearch },
    { icon: Network, label: "Reload Colors", color: "text-accent-blue", onClick: async () => {
      await window.api.ssh.reloadColors();
    }},
    { icon: Globe, label: "Help", color: "text-accent-green", onClick: aboutBox },
    { icon: RotateCw, label: "Recarregar inventário", color: "text-accent-yellow", onClick: async () => {
      const s = await window.api.inventory.load();
      useStore.getState().setSessions(s);
    }},
    { icon: Activity, label: "Settings (monitor)", color: "text-accent-green", onClick: openSettings },
    { icon: Database, label: "Sessions list", color: "text-accent-blue", onClick: focusSearch },
    { icon: SettingsIcon, label: "Settings", color: "text-fg-soft", onClick: openSettings },
    { icon: HelpCircle, label: "Help / About", color: "text-fg-soft", onClick: aboutBox },
  ];

  return (
    <div className="bg-gradient-to-b from-[#1a1a1a] to-[#111111] border-b border-border">
      <div className="flex items-center h-8 px-3 text-xs">
        <div className="flex items-center gap-1.5 mr-4">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan shadow-[0_0_6px_rgba(0,217,255,0.8)]" />
          <span className="font-mono font-bold text-fg tracking-wider text-[11px]">
            SJNET <span className="text-accent-cyan">NOC</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {MENUS.map((m) => (
            <button
              key={m.label}
              onClick={m.onClick}
              className="text-fg-soft hover:text-accent-cyan transition-colors text-[12px]"
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-fg-soft font-mono">
          {activeTab && (
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeTab.status === "connected"
                    ? "bg-accent-green shadow-glow-green"
                    : "bg-accent-yellow"
                }`}
              />
              <span className="text-fg">{activeTab.host}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 px-3 h-10 border-t border-border-soft">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            title={t.label}
            onClick={t.onClick}
            className="group flex items-center justify-center w-8 h-8 rounded hover:bg-bg-elevated hover:shadow-glow-blue transition-all cursor-pointer"
          >
            <t.icon
              className={`w-4 h-4 ${t.color} group-hover:scale-110 transition-transform`}
            />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-fg-soft font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-glow-green" />
          <span>NOC v0.1</span>
        </div>
      </div>
    </div>
  );
}
