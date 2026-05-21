import { useEffect, useState } from "react";
import {
  X,
  Palette,
  Type,
  Eye,
  Activity,
  RotateCw,
  Save,
  RefreshCw,
} from "lucide-react";
import { useStore } from "../store";
import type { AppSettings } from "../types";
import { BackupPanel } from "./BackupPanel";

export function SettingsPanel() {
  const { settings, setSettings, settingsOpen, setSettingsOpen } = useStore();
  const [local, setLocal] = useState<AppSettings | null>(null);
  const [reloadStatus, setReloadStatus] = useState<string>("");

  useEffect(() => {
    if (settingsOpen && settings) setLocal({ ...settings });
  }, [settingsOpen, settings]);

  if (!settingsOpen || !local) return null;

  const save = async () => {
    await window.api.settings.save(local);
    setSettings(local);
    setSettingsOpen(false);
  };

  const reloadColors = async () => {
    setReloadStatus("recarregando...");
    const n = await window.api.ssh.reloadColors();
    setReloadStatus(`${n} regras carregadas`);
    setTimeout(() => setReloadStatus(""), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-panel border border-border rounded-lg w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
          <h2 className="text-fg font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent-cyan" />
            Settings
          </h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-fg-dim hover:text-fg p-1 rounded hover:bg-bg-elevated"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <Section icon={Palette} title="Colorização Cisco">
            <Toggle
              label="Aplicar keyword highlighting Cisco"
              desc="Cores das regras de Cisco Words.ini + Lab Highlights.ini (SecureCRT)"
              value={local.colorizationEnabled}
              onChange={(v) =>
                setLocal({ ...local, colorizationEnabled: v })
              }
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => useStore.getState().setKeywordEditorOpen(true)}
                className="flex items-center gap-2 text-[12px] px-3 py-1.5 rounded bg-accent-cyan/10 border border-accent-cyan text-accent-cyan hover:bg-accent-cyan/20 transition-all"
              >
                <Palette className="w-3 h-3" />
                Editar regras (regex + cor)
              </button>
              <button
                onClick={reloadColors}
                className="flex items-center gap-2 text-[12px] px-3 py-1.5 rounded bg-bg-soft border border-border hover:border-accent-cyan text-fg-soft hover:text-fg transition-all"
              >
                <RotateCw className="w-3 h-3" />
                Recarregar
                {reloadStatus && (
                  <span className="text-accent-cyan text-[11px] ml-2">
                    {reloadStatus}
                  </span>
                )}
              </button>
            </div>
          </Section>

          <Section icon={Type} title="Fonte do terminal">
            <Field
              label="Família"
              value={local.fontFamily}
              onChange={(v) => setLocal({ ...local, fontFamily: v })}
            />
            <NumField
              label="Tamanho (px)"
              value={local.fontSize}
              min={9}
              max={28}
              onChange={(v) => setLocal({ ...local, fontSize: v })}
            />
          </Section>

          <Section icon={Eye} title="Aparência do terminal">
            <Toggle
              label="Cursor piscante"
              value={local.cursorBlink}
              onChange={(v) => setLocal({ ...local, cursorBlink: v })}
            />
            <NumField
              label="Scrollback (linhas)"
              value={local.scrollback}
              min={100}
              max={100000}
              step={1000}
              onChange={(v) => setLocal({ ...local, scrollback: v })}
            />
          </Section>

          <Section icon={Activity} title="Monitor CPU/RAM">
            <Toggle
              label="Monitorar device em segundo plano"
              desc="Abre 2ª SSH session paralela e roda comando de status periodicamente"
              value={local.monitorEnabled}
              onChange={(v) => setLocal({ ...local, monitorEnabled: v })}
            />
            <NumField
              label="Intervalo (seg)"
              value={local.monitorIntervalSec}
              min={2}
              max={60}
              onChange={(v) =>
                setLocal({ ...local, monitorIntervalSec: v })
              }
            />
          </Section>

          <Section icon={Save} title="Backup / Restore">
            <BackupPanel />
            <p className="text-[10px] text-fg-dim mt-2 font-mono">
              Exporta sessões, settings e regras Cisco pra um JSON.
              Import permite escolher exatamente o que aplicar.
            </p>
          </Section>

          <Section icon={RefreshCw} title="Auto-update">
            <UpdateButton />
          </Section>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-soft bg-bg-soft">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-1.5 rounded bg-bg-elevated text-fg-soft hover:text-fg text-[12px] border border-border"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            className="px-4 py-1.5 rounded bg-accent-blue/20 border border-accent-blue text-accent-cyan hover:bg-accent-blue/30 hover:shadow-glow-blue text-[12px] font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateButton() {
  const [status, setStatus] = useState<string>("");
  const check = async () => {
    setStatus("verificando...");
    const r = await window.api.updater.check();
    if (r.error) setStatus("erro: " + r.error);
    else if (r.updateAvailable)
      setStatus(`nova versão ${r.version} disponível — baixando...`);
    else setStatus(`atualizado (v${r.currentVersion})`);
  };
  return (
    <div>
      <button
        onClick={check}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-soft border border-border hover:border-accent-cyan hover:shadow-glow-blue text-fg text-[12px] transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5 text-accent-cyan" />
        Verificar atualizações
      </button>
      {status && (
        <div className="mt-2 text-[11px] text-fg-soft font-mono">{status}</div>
      )}
      <p className="text-[10px] text-fg-dim mt-2 font-mono">
        Conecta no GitHub Releases. App reinicia automático após baixar.
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-fg font-semibold text-[12px] uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 text-accent-cyan" />
        {title}
      </div>
      <div className="space-y-2 pl-1">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!value)}
        className={`mt-0.5 w-8 h-4 rounded-full p-0.5 transition-colors flex items-center ${
          value ? "bg-accent-cyan" : "bg-bg-elevated border border-border"
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : ""
          }`}
        />
      </div>
      <div className="flex-1">
        <div className="text-fg text-[12px]">{label}</div>
        {desc && <div className="text-fg-dim text-[11px] mt-0.5">{desc}</div>}
      </div>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-fg-soft text-[12px] w-32">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-bg-soft border border-border text-fg text-[12px] rounded px-2 py-1 font-mono focus:outline-none focus:border-accent-cyan"
      />
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-fg-soft text-[12px] w-32">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-24 bg-bg-soft border border-border text-fg text-[12px] rounded px-2 py-1 font-mono focus:outline-none focus:border-accent-cyan"
      />
    </div>
  );
}
