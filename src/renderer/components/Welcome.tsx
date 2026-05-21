import { Terminal, Settings as SettingsIcon, RefreshCw, Activity } from "lucide-react";
import { useStore } from "../store";

export function Welcome() {
  const { sessions, sidebarSearchRef, setSettingsOpen, setSessions } = useStore();

  const focusSearch = () => sidebarSearchRef?.current?.focus();
  const openSettings = () => setSettingsOpen(true);
  const reloadInventory = async () => {
    const s = await window.api.inventory.load();
    setSessions(s);
  };
  const reloadColors = async () => {
    const n = await window.api.ssh.reloadColors();
    alert(`${n} regras de cor carregadas`);
  };

  return (
    <div className="h-full w-full flex items-center justify-center font-mono">
      <div className="text-center max-w-xl px-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(0,217,255,1)] animate-pulse" />
          <span className="text-accent-cyan font-bold tracking-[0.3em] text-sm">
            IspFull NOC
          </span>
          <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(0,217,255,1)] animate-pulse" />
        </div>
        <h1 className="text-2xl text-fg mb-1 font-sans">Network Operations Center</h1>
        <p className="text-fg-soft text-xs mb-8 font-sans">
          {sessions.length} sessões importadas
        </p>

        <div className="grid grid-cols-2 gap-3 text-left">
          <Card
            icon={Terminal}
            title="Quick Connect"
            desc="Buscar sessão na sidebar (Cmd+K)"
            iconClass="text-accent-cyan"
            onClick={focusSearch}
          />
          <Card
            icon={SettingsIcon}
            title="Settings"
            desc="Cores Cisco, fonte, monitor CPU/RAM"
            iconClass="text-accent-orange"
            onClick={openSettings}
          />
          <Card
            icon={RefreshCw}
            title="Recarregar inventário"
            desc="Re-sincroniza sessões e Keychain"
            iconClass="text-accent-blue"
            onClick={reloadInventory}
          />
          <Card
            icon={Activity}
            title="Recarregar cores"
            desc="Atualiza regras Cisco Words sem restart"
            iconClass="text-accent-green"
            onClick={reloadColors}
          />
        </div>

        <div className="mt-8 text-[11px] text-fg-dim">
          dbl-click numa sessão da sidebar para abrir
        </div>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  desc,
  iconClass,
  onClick,
}: {
  icon: typeof Terminal;
  title: string;
  desc: string;
  iconClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-bg-panel border border-border rounded p-3 hover:border-accent-blue/60 hover:shadow-glow-blue hover:bg-bg-soft transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="text-fg text-[13px] font-semibold font-sans">{title}</span>
      </div>
      <p className="text-fg-soft text-[11px] font-sans">{desc}</p>
    </button>
  );
}
