import { useState } from "react";
import {
  Download,
  Upload,
  CheckSquare,
  Square,
  Server,
  KeyRound,
  Palette,
  Sliders,
} from "lucide-react";
import { useStore } from "../store";
import type { BackupBundle, ImportOptions } from "../types";

type Mode = "idle" | "export" | "import-preview" | "import-apply";

export function BackupPanel() {
  const { sessions, reloadSessions } = useStore();
  const [mode, setMode] = useState<Mode>("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(sessions.map((s) => s.id))
  );
  const [includePasswords, setIncludePasswords] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(true);
  const [includeColorRules, setIncludeColorRules] = useState(true);

  // Import state
  const [importedBundle, setImportedBundle] = useState<BackupBundle | null>(null);
  const [importFile, setImportFile] = useState<string>("");
  const [importPasswords, setImportPasswords] = useState(true);
  const [importSettings, setImportSettings] = useState(true);
  const [importColorRules, setImportColorRules] = useState(true);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importSelectedIds, setImportSelectedIds] = useState<Set<string>>(
    new Set()
  );

  const allSelected = selectedIds.size === sessions.length && sessions.length > 0;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sessions.map((s) => s.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const doExport = async () => {
    const r = await window.api.backup.export({
      selectedSessionIds: Array.from(selectedIds),
      includePasswords,
      includeSettings,
      includeColorRules,
    });
    if (r.ok) {
      alert(
        `Exportado: ${r.sessionCount ?? 0} sessões → ${r.path}`
      );
      setMode("idle");
    }
  };

  const doImportPreview = async () => {
    const r = await window.api.backup.preview();
    if (!r) {
      setMode("idle");
      return;
    }
    if ("error" in r) {
      alert("Erro: " + r.error);
      return;
    }
    setImportedBundle(r.bundle);
    setImportFile(r.filePath);
    setImportSelectedIds(new Set(r.bundle.sessions?.map((s) => s.id) ?? []));
    setMode("import-preview");
  };

  const doImportApply = async () => {
    if (!importedBundle) return;
    if (importMode === "replace") {
      if (
        !confirm(
          "Modo SUBSTITUIR vai apagar todas as sessões atuais e usar apenas o backup. Confirma?"
        )
      )
        return;
    }
    const opts: ImportOptions = {
      selectedSessionIds: Array.from(importSelectedIds),
      importPasswords,
      importSettings,
      importColorRules,
      mode: importMode,
    };
    const r = await window.api.backup.apply(importedBundle, opts);
    if (r.ok) {
      alert(`Importadas: ${r.importedSessions} sessões`);
      await reloadSessions();
      setMode("idle");
      setImportedBundle(null);
    }
  };

  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setMode("export")}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-soft border border-border hover:border-accent-cyan hover:shadow-glow-blue text-fg text-[12px] transition-all"
        >
          <Download className="w-3.5 h-3.5 text-accent-green" />
          Exportar backup
        </button>
        <button
          onClick={doImportPreview}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-soft border border-border hover:border-accent-orange hover:shadow-glow-blue text-fg text-[12px] transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-accent-orange" />
          Importar backup
        </button>
      </div>
    );
  }

  if (mode === "export") {
    return (
      <div className="space-y-3">
        <div className="text-fg font-semibold text-[12px]">Exportar configuração</div>
        <ToggleBox
          icon={KeyRound}
          label="Incluir senhas SSH (do Keychain)"
          desc="Senhas em texto plano no arquivo de backup — guarda em local seguro!"
          value={includePasswords}
          onChange={setIncludePasswords}
          danger={includePasswords}
        />
        <ToggleBox
          icon={Sliders}
          label="Incluir settings do app"
          desc="Fonte, cores, monitor, etc"
          value={includeSettings}
          onChange={setIncludeSettings}
        />
        <ToggleBox
          icon={Palette}
          label="Incluir regras Cisco (Keywords.ini)"
          desc="Cisco Words.ini + Lab Highlights.ini"
          value={includeColorRules}
          onChange={setIncludeColorRules}
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-fg-soft text-[11px] font-mono uppercase tracking-wider">
              Sessões ({selectedIds.size}/{sessions.length})
            </span>
            <button
              onClick={toggleAll}
              className="text-[11px] text-accent-cyan hover:underline"
            >
              {allSelected ? "Limpar" : "Selecionar tudo"}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto bg-bg-soft border border-border rounded p-1">
            {sessions.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 px-1 py-0.5 hover:bg-bg-elevated cursor-pointer text-[12px]"
              >
                {selectedIds.has(s.id) ? (
                  <CheckSquare className="w-3.5 h-3.5 text-accent-cyan" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-fg-dim" />
                )}
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => toggleOne(s.id)}
                  className="sr-only"
                />
                <Server className="w-3 h-3 text-fg-dim" />
                <span className="flex-1 truncate">{s.path}</span>
                <span className="text-fg-dim text-[10px] font-mono">
                  {s.host}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setMode("idle")}
            className="px-3 py-1.5 rounded bg-bg-elevated text-fg-soft hover:text-fg text-[12px] border border-border"
          >
            Cancelar
          </button>
          <button
            onClick={doExport}
            className="px-3 py-1.5 rounded bg-accent-green/20 border border-accent-green text-accent-green hover:bg-accent-green/30 text-[12px] font-semibold"
          >
            Exportar para arquivo
          </button>
        </div>
      </div>
    );
  }

  if (mode === "import-preview" && importedBundle) {
    const bSessions = importedBundle.sessions ?? [];
    const allImpSelected = importSelectedIds.size === bSessions.length;
    return (
      <div className="space-y-3">
        <div className="text-fg font-semibold text-[12px]">Importar configuração</div>
        <div className="text-[11px] text-fg-soft font-mono bg-bg-soft border border-border rounded p-2">
          <div>Arquivo: <span className="text-accent-cyan">{importFile.split("/").pop()}</span></div>
          <div>Exportado em: {new Date(importedBundle.exportedAt).toLocaleString()}</div>
          <div>App v{importedBundle.appVersion}</div>
          <div>
            Conteúdo: {bSessions.length} sessões
            {importedBundle.settings && ", settings"}
            {importedBundle.colorRules && ", regras Cisco"}
          </div>
        </div>

        <div className="flex gap-2">
          <ModePill
            active={importMode === "merge"}
            onClick={() => setImportMode("merge")}
            label="Mesclar"
            desc="adiciona/atualiza sessões"
          />
          <ModePill
            active={importMode === "replace"}
            onClick={() => setImportMode("replace")}
            label="Substituir"
            desc="apaga atuais primeiro"
            danger
          />
        </div>

        {importedBundle.sessions && (
          <ToggleBox
            icon={KeyRound}
            label="Importar senhas (se presentes no arquivo)"
            desc={
              importedBundle.sessions.some((s) => s.password)
                ? "Backup contém senhas em texto"
                : "Backup não tem senhas"
            }
            value={importPasswords}
            onChange={setImportPasswords}
          />
        )}
        {importedBundle.settings && (
          <ToggleBox
            icon={Sliders}
            label="Importar settings"
            value={importSettings}
            onChange={setImportSettings}
          />
        )}
        {importedBundle.colorRules && (
          <ToggleBox
            icon={Palette}
            label="Importar regras Cisco"
            value={importColorRules}
            onChange={setImportColorRules}
          />
        )}

        {bSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-fg-soft text-[11px] font-mono uppercase tracking-wider">
                Sessões a importar ({importSelectedIds.size}/{bSessions.length})
              </span>
              <button
                onClick={() =>
                  setImportSelectedIds(
                    allImpSelected
                      ? new Set()
                      : new Set(bSessions.map((s) => s.id))
                  )
                }
                className="text-[11px] text-accent-cyan hover:underline"
              >
                {allImpSelected ? "Limpar" : "Selecionar tudo"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto bg-bg-soft border border-border rounded p-1">
              {bSessions.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-1 py-0.5 hover:bg-bg-elevated cursor-pointer text-[12px]"
                >
                  {importSelectedIds.has(s.id) ? (
                    <CheckSquare className="w-3.5 h-3.5 text-accent-cyan" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-fg-dim" />
                  )}
                  <input
                    type="checkbox"
                    checked={importSelectedIds.has(s.id)}
                    onChange={() => {
                      const next = new Set(importSelectedIds);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      setImportSelectedIds(next);
                    }}
                    className="sr-only"
                  />
                  <Server className="w-3 h-3 text-fg-dim" />
                  <span className="flex-1 truncate">{s.path}</span>
                  {s.password && (
                    <KeyRound className="w-3 h-3 text-accent-yellow" />
                  )}
                  <span className="text-fg-dim text-[10px] font-mono">
                    {s.host}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => {
              setMode("idle");
              setImportedBundle(null);
            }}
            className="px-3 py-1.5 rounded bg-bg-elevated text-fg-soft hover:text-fg text-[12px] border border-border"
          >
            Cancelar
          </button>
          <button
            onClick={doImportApply}
            className="px-3 py-1.5 rounded bg-accent-orange/20 border border-accent-orange text-accent-orange hover:bg-accent-orange/30 text-[12px] font-semibold"
          >
            Aplicar import
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function ToggleBox({
  icon: Icon,
  label,
  desc,
  value,
  onChange,
  danger,
}: {
  icon: typeof Server;
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 ${danger ? "accent-accent-red" : "accent-accent-cyan"}`}
      />
      <Icon className={`w-3.5 h-3.5 mt-0.5 ${danger && value ? "text-accent-red" : "text-fg-soft"}`} />
      <div className="flex-1">
        <div className={`text-[12px] ${danger && value ? "text-accent-red" : "text-fg"}`}>{label}</div>
        {desc && <div className="text-fg-dim text-[10px] mt-0.5">{desc}</div>}
      </div>
    </label>
  );
}

function ModePill({
  active,
  onClick,
  label,
  desc,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded border text-left ${
        active
          ? danger
            ? "bg-accent-red/20 border-accent-red text-accent-red"
            : "bg-accent-cyan/20 border-accent-cyan text-accent-cyan"
          : "bg-bg-soft border-border text-fg-soft hover:text-fg"
      }`}
    >
      <div className="text-[12px] font-semibold">{label}</div>
      <div className="text-[10px] opacity-70">{desc}</div>
    </button>
  );
}
