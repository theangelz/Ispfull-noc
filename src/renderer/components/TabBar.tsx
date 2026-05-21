import { X, Circle } from "lucide-react";
import { useStore } from "../store";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useStore();

  if (tabs.length === 0) {
    return (
      <div className="h-9 bg-bg-panel border-b border-border-soft flex items-center px-3 text-[11px] text-fg-dim font-mono">
        Nenhuma sessão aberta — dbl-click numa sessão da sidebar
      </div>
    );
  }

  return (
    <div className="h-9 bg-bg-panel border-b border-border-soft flex items-stretch overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.tabId === activeTabId;
        return (
          <div
            key={tab.tabId}
            onClick={() => setActiveTab(tab.tabId)}
            className={`group flex items-center gap-2 px-3 cursor-pointer border-r border-border-soft min-w-[160px] max-w-[240px] ${
              active
                ? "bg-bg-main border-t-2 border-t-accent-blue text-fg"
                : "border-t-2 border-t-transparent text-fg-soft hover:bg-bg-soft hover:text-fg"
            }`}
          >
            <Circle
              className={`w-2 h-2 shrink-0 ${
                tab.status === "connected"
                  ? "text-accent-green fill-accent-green"
                  : tab.status === "connecting"
                    ? "text-accent-yellow fill-accent-yellow animate-pulse"
                    : tab.status === "error"
                      ? "text-accent-red fill-accent-red"
                      : "text-fg-dim fill-fg-dim"
              }`}
            />
            <span className="text-[12px] truncate font-medium">{tab.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.tabId);
              }}
              className="ml-auto w-4 h-4 rounded shrink-0 flex items-center justify-center text-fg-dim hover:bg-accent-red/20 hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
              title="Fechar tab"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
