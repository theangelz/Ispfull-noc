import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { TerminalView } from "./components/TerminalView";
import { StatusBar } from "./components/StatusBar";
import { Welcome } from "./components/Welcome";
import { SettingsPanel } from "./components/SettingsPanel";
import { SessionForm } from "./components/SessionForm";
import { KeywordEditor } from "./components/KeywordEditor";
import { useStore } from "./store";

export function App() {
  const { tabs, activeTabId, setSessions, setSettings, setSettingsOpen } = useStore();

  useEffect(() => {
    window.api.inventory.load().then(setSessions);
    window.api.settings.get().then(setSettings);
  }, [setSessions, setSettings]);

  // Cmd+, abre Settings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSettingsOpen]);

  return (
    <div className="h-screen flex flex-col bg-bg-main text-fg font-sans">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TabBar />
          <div className="flex-1 min-h-0 relative bg-bg-main">
            {tabs.length === 0 && <Welcome />}
            {tabs.map((tab) => {
              const isActive = tab.tabId === activeTabId;
              return (
                <div
                  key={tab.tabId}
                  className="absolute inset-0"
                  style={{
                    // Mantém dimensões em tabs inativas (display:none zerava o xterm)
                    visibility: isActive ? "visible" : "hidden",
                    pointerEvents: isActive ? "auto" : "none",
                    zIndex: isActive ? 1 : 0,
                  }}
                >
                  <TerminalView tab={tab} isActive={isActive} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <StatusBar />
      <SettingsPanel />
      <SessionForm />
      <KeywordEditor />
    </div>
  );
}
