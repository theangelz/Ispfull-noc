import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Search,
  Bold,
  Palette,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "../store";
import type { KeywordRule } from "../types";

function validateRegex(pattern: string): string | null {
  if (!pattern) return "vazio";
  try {
    new RegExp(pattern);
  } catch (e: any) {
    return e?.message ?? "regex inválida";
  }
  return null;
}

const PRESET_COLORS = [
  "#FF4D4D", // red
  "#FF9D00", // orange
  "#FFD83D", // yellow
  "#5CFF72", // green
  "#00D9FF", // cyan
  "#00BFFF", // blue
  "#D6D6D6", // white
  "#FF7AD9", // magenta
];

export function KeywordEditor() {
  const { keywordEditorOpen, setKeywordEditorOpen } = useStore();
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [query, setQuery] = useState("");
  const [activeFile, setActiveFile] = useState<KeywordRule["file"]>(
    "Cisco Words.ini"
  );
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (keywordEditorOpen) {
      window.api.keywords.load().then((r) => {
        setRules(r);
        setDirty(false);
      });
    }
  }, [keywordEditorOpen]);

  const fileRules = useMemo(
    () => rules.filter((r) => r.file === activeFile),
    [rules, activeFile]
  );

  const filtered = useMemo(() => {
    if (!query) return fileRules;
    const q = query.toLowerCase();
    return fileRules.filter((r) => r.pattern.toLowerCase().includes(q));
  }, [fileRules, query]);

  const updateRule = (id: string, patch: Partial<KeywordRule>) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const deleteRule = (id: string) => {
    setRules((rs) => rs.filter((r) => r.id !== id));
    setDirty(true);
  };

  const addRule = () => {
    const id = `${activeFile}::new-${Date.now()}`;
    const newR: KeywordRule = {
      id,
      pattern: "",
      color: "#00D9FF",
      bold: false,
      enabled: true,
      file: activeFile,
    };
    setRules((rs) => [...rs, newR]);
    setEditingId(id);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await window.api.keywords.save(rules);
      // Reaplica no backend de SSH
      await window.api.ssh.reloadColors();
      setDirty(false);
      alert("Regras salvas e aplicadas em tempo real");
    } catch (e: any) {
      alert("Erro ao salvar: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty && !confirm("Tem alterações não salvas. Fechar mesmo assim?"))
      return;
    setKeywordEditorOpen(false);
  };

  if (!keywordEditorOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-panel border border-border rounded-lg w-[860px] max-h-[88vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
          <h2 className="text-fg font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent-cyan" />
            Editor de Keywords Cisco
            {dirty && (
              <span className="text-accent-yellow text-[10px] ml-2">●  não salvo</span>
            )}
          </h2>
          <button
            onClick={close}
            className="text-fg-dim hover:text-fg p-1 rounded hover:bg-bg-elevated"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-border-soft text-[12px]">
          <FileTab
            label="Cisco Words.ini"
            count={rules.filter((r) => r.file === "Cisco Words.ini").length}
            active={activeFile === "Cisco Words.ini"}
            onClick={() => setActiveFile("Cisco Words.ini")}
          />
          <FileTab
            label="Lab Highlights.ini"
            count={rules.filter((r) => r.file === "Lab Highlights.ini").length}
            active={activeFile === "Lab Highlights.ini"}
            onClick={() => setActiveFile("Lab Highlights.ini")}
          />
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-soft">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-fg-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar regex..."
              className="w-full bg-bg-soft border border-border text-fg text-[12px] rounded pl-7 pr-2 py-1 focus:outline-none focus:border-accent-cyan font-mono"
            />
          </div>
          <button
            onClick={addRule}
            className="flex items-center gap-1 px-3 py-1 rounded bg-accent-cyan/10 border border-accent-cyan text-accent-cyan text-[12px] hover:bg-accent-cyan/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova regra
          </button>
        </div>
        <div className="px-4 py-1.5 border-b border-border-soft bg-bg-soft text-[10px] text-fg-dim font-mono">
          <span className="text-accent-yellow">dica:</span> caracteres especiais precisam de escape — pra pegar literal use
          <code className="text-accent-cyan mx-1">\*</code> (asterisco),
          <code className="text-accent-cyan mx-1">\.</code> (ponto),
          <code className="text-accent-cyan mx-1">\?</code> (?),
          <code className="text-accent-cyan mx-1">\(</code>,
          <code className="text-accent-cyan mx-1">\[</code>, etc.
          Texto comum (palavras) não precisa escapar.
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[12px] font-mono">
            <thead className="sticky top-0 bg-bg-panel border-b border-border-soft text-fg-soft text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-1.5 text-left w-12">On</th>
                <th className="px-3 py-1.5 text-left">Regex</th>
                <th className="px-3 py-1.5 text-left w-32">Cor</th>
                <th className="px-3 py-1.5 text-left w-16">Bold</th>
                <th className="px-3 py-1.5 text-left w-32">Preview</th>
                <th className="px-3 py-1.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Row
                  key={r.id}
                  rule={r}
                  editing={editingId === r.id}
                  onEdit={() => setEditingId(r.id)}
                  onBlur={() => setEditingId(null)}
                  onUpdate={(patch) => updateRule(r.id, patch)}
                  onDelete={() => deleteRule(r.id)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-fg-dim py-8 text-[12px]">
                    {query
                      ? "Nenhuma regra com esse regex"
                      : "Nenhuma regra. Clica em 'Nova regra' acima"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border-soft bg-bg-soft text-[11px]">
          <div className="text-fg-dim flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {filtered.length} regra(s) em {activeFile}
          </div>
          <div className="flex gap-2">
            <button
              onClick={close}
              className="px-3 py-1.5 rounded bg-bg-elevated text-fg-soft hover:text-fg text-[12px] border border-border"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-accent-green/20 border border-accent-green text-accent-green text-[12px] font-semibold hover:bg-accent-green/30 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : "Salvar e aplicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 ${
        active
          ? "bg-bg-main text-accent-cyan border-b-2 border-accent-cyan -mb-px"
          : "text-fg-soft hover:text-fg"
      }`}
    >
      {label}{" "}
      <span className="text-fg-dim text-[10px] ml-1">({count})</span>
    </button>
  );
}

function Row({
  rule,
  editing,
  onEdit,
  onBlur,
  onUpdate,
  onDelete,
}: {
  rule: KeywordRule;
  editing: boolean;
  onEdit: () => void;
  onBlur: () => void;
  onUpdate: (patch: Partial<KeywordRule>) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-border-soft hover:bg-bg-elevated/30">
      <td className="px-3 py-1">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          className="accent-accent-cyan"
        />
      </td>
      <td className="px-3 py-1">
        {(() => {
          const error = validateRegex(rule.pattern);
          return (
            <div className="flex items-center gap-1">
              {editing ? (
                <input
                  value={rule.pattern}
                  autoFocus
                  onChange={(e) => onUpdate({ pattern: e.target.value })}
                  onBlur={onBlur}
                  onKeyDown={(e) => e.key === "Enter" && onBlur()}
                  className={`flex-1 bg-bg-soft border text-fg text-[12px] rounded px-2 py-0.5 font-mono ${
                    error ? "border-accent-red" : "border-accent-cyan"
                  }`}
                />
              ) : (
                <button
                  onClick={onEdit}
                  className={`flex-1 text-left font-mono ${
                    rule.enabled ? "text-fg" : "text-fg-dim line-through"
                  } hover:text-accent-cyan ${error ? "underline decoration-accent-red decoration-wavy" : ""}`}
                >
                  {rule.pattern || (
                    <span className="text-fg-dim italic">(vazio)</span>
                  )}
                </button>
              )}
              {error && rule.pattern && (
                <AlertTriangle
                  className="w-3.5 h-3.5 text-accent-red shrink-0"
                  aria-label={`regex inválida: ${error}. Pra pegar caractere literal, escapa com \\ (ex: \\* pra asterisco).`}
                />
              )}
            </div>
          );
        })()}
      </td>
      <td className="px-3 py-1">
        <ColorCell color={rule.color} onChange={(c) => onUpdate({ color: c })} />
      </td>
      <td className="px-3 py-1">
        <button
          onClick={() => onUpdate({ bold: !rule.bold })}
          className={`p-1 rounded ${
            rule.bold
              ? "bg-accent-cyan/20 text-accent-cyan"
              : "text-fg-dim hover:text-fg"
          }`}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
      </td>
      <td className="px-3 py-1">
        <span
          style={{
            color: rule.color,
            fontWeight: rule.bold ? 700 : 400,
            opacity: rule.enabled ? 1 : 0.4,
          }}
          className="font-mono text-[12px]"
        >
          {rule.pattern.slice(0, 18) || "..."}
        </span>
      </td>
      <td className="px-3 py-1">
        <button
          onClick={onDelete}
          className="text-fg-dim hover:text-accent-red p-1"
          title="Apagar regra"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function ColorCell({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-0.5 rounded border border-border bg-bg-soft hover:border-accent-cyan"
      >
        <span
          className="w-4 h-4 rounded border border-border-soft shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-fg-soft font-mono text-[11px]">{color}</span>
      </button>
      {open && (
        <div
          className="absolute z-10 top-full mt-1 left-0 bg-bg-panel border border-border rounded shadow-2xl p-2 flex flex-col gap-2"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="grid grid-cols-4 gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="w-6 h-6 rounded border border-border-soft hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="w-full h-7 rounded cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
