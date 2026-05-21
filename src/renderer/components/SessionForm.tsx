import { useEffect, useState } from "react";
import {
  X,
  Server,
  User,
  Lock,
  Folder,
  Globe,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { useStore } from "../store";

export function SessionForm() {
  const { sessionForm, closeSessionForm, reloadSessions } = useStore();
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [hasExistingPw, setHasExistingPw] = useState(false);
  const [clearPw, setClearPw] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [protocol, setProtocol] = useState<"ssh" | "telnet">("ssh");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!sessionForm) return;
    if (sessionForm.mode === "edit" && sessionForm.session) {
      const s = sessionForm.session;
      setName(s.name);
      setFolder(s.folder);
      setHost(s.host);
      setPort(s.port);
      setUser(s.user);
      setPassword("");
      setHasExistingPw(s.hasPassword);
      setClearPw(false);
      setProtocol(s.protocol ?? "ssh");
    } else {
      setName("");
      setFolder(sessionForm.presetFolder ?? "");
      setHost("");
      setPort(22);
      setUser("admin");
      setPassword("");
      setHasExistingPw(false);
      setClearPw(false);
      setProtocol("ssh");
    }
    window.api.inventory.folders().then(setFolders);
  }, [sessionForm]);

  if (!sessionForm) return null;

  const isEdit = sessionForm.mode === "edit";

  const save = async () => {
    if (!name.trim() || !host.trim()) {
      alert("Nome e host são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && sessionForm.session) {
        await window.api.inventory.update({
          id: sessionForm.session.id,
          name: name.trim(),
          folder: folder.trim(),
          host: host.trim(),
          port,
          user: user.trim(),
          password: password || undefined,
          clearPassword: clearPw,
          protocol,
        });
      } else {
        await window.api.inventory.create({
          name: name.trim(),
          folder: folder.trim(),
          host: host.trim(),
          port,
          user: user.trim(),
          password: password || undefined,
          protocol,
        });
      }
      await reloadSessions();
      closeSessionForm();
    } catch (e: any) {
      alert("Erro ao salvar: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit || !sessionForm.session) return;
    if (
      !confirm(
        `Apagar sessão "${sessionForm.session.name}"?\nA senha no Keychain também será removida.`
      )
    )
      return;
    setDeleting(true);
    try {
      await window.api.inventory.delete(sessionForm.session.id);
      await reloadSessions();
      closeSessionForm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-panel border border-border rounded-lg w-[480px] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
          <h2 className="text-fg font-semibold flex items-center gap-2">
            <Server className="w-4 h-4 text-accent-cyan" />
            {isEdit ? "Editar sessão" : "Nova sessão SSH"}
          </h2>
          <button
            onClick={closeSessionForm}
            className="text-fg-dim hover:text-fg p-1 rounded hover:bg-bg-elevated"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <Field
            icon={Server}
            label="Nome"
            value={name}
            onChange={setName}
            placeholder="ex: PE04-POPRJ"
            autoFocus
          />
          <FolderField
            value={folder}
            onChange={setFolder}
            options={folders}
          />
          <div>
            <label className="text-fg-soft text-[11px] block mb-1 font-mono uppercase tracking-wider">
              Protocolo
            </label>
            <div className="flex gap-2">
              <ProtoPill
                active={protocol === "ssh"}
                onClick={() => {
                  setProtocol("ssh");
                  if (port === 23 || port === 2223) setPort(22);
                }}
                label="SSH"
                desc="default :22"
              />
              <ProtoPill
                active={protocol === "telnet"}
                onClick={() => {
                  setProtocol("telnet");
                  if (port === 22) setPort(23);
                }}
                label="Telnet"
                desc="default :23"
              />
            </div>
          </div>
          <Field
            icon={Globe}
            label="Host / IP"
            value={host}
            onChange={setHost}
            placeholder="10.10.0.1"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <Field
                icon={User}
                label="Usuário"
                value={user}
                onChange={setUser}
                placeholder="admin"
              />
            </div>
            <div className="w-24">
              <label className="text-fg-soft text-[11px] block mb-1 font-mono uppercase tracking-wider">
                Porta
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 22)}
                className="w-full bg-bg-soft border border-border text-fg text-[13px] rounded px-2 py-1.5 font-mono focus:outline-none focus:border-accent-cyan focus:shadow-glow-blue"
              />
            </div>
          </div>

          <div>
            <label className="text-fg-soft text-[11px] block mb-1 font-mono uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Senha SSH {hasExistingPw && <span className="text-accent-green normal-case">(salva no Keychain)</span>}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasExistingPw ? "(deixar vazio mantém a atual)" : "senha SSH"}
                disabled={clearPw}
                className="w-full bg-bg-soft border border-border text-fg text-[13px] rounded px-2 py-1.5 pr-9 font-mono focus:outline-none focus:border-accent-cyan focus:shadow-glow-blue disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1.5 text-fg-dim hover:text-fg"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isEdit && hasExistingPw && (
              <label className="flex items-center gap-2 mt-2 text-[11px] text-fg-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearPw}
                  onChange={(e) => setClearPw(e.target.checked)}
                  className="accent-accent-red"
                />
                Remover senha salva (usar SSH key/agent)
              </label>
            )}
            <p className="text-[10px] text-fg-dim mt-1 font-mono">
              Senha salva no macOS Keychain. Sem senha → tenta SSH key/agent.
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center gap-2 px-4 py-3 border-t border-border-soft bg-bg-soft">
          {isEdit ? (
            <button
              onClick={remove}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-accent-red hover:bg-accent-red/10 text-[12px] disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Apagar
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={closeSessionForm}
              className="px-4 py-1.5 rounded bg-bg-elevated text-fg-soft hover:text-fg text-[12px] border border-border"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-1.5 rounded bg-accent-blue/20 border border-accent-blue text-accent-cyan hover:bg-accent-blue/30 hover:shadow-glow-blue text-[12px] font-semibold disabled:opacity-50"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtoPill({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded border text-left ${
        active
          ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan"
          : "bg-bg-soft border-border text-fg-soft hover:text-fg"
      }`}
    >
      <div className="text-[12px] font-semibold">{label}</div>
      <div className="text-[10px] opacity-70">{desc}</div>
    </button>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-fg-soft text-[11px] block mb-1 font-mono uppercase tracking-wider flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </label>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-soft border border-border text-fg text-[13px] rounded px-2 py-1.5 font-mono focus:outline-none focus:border-accent-cyan focus:shadow-glow-blue placeholder:text-fg-dim"
      />
    </div>
  );
}

function FolderField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="text-fg-soft text-[11px] block mb-1 font-mono uppercase tracking-wider flex items-center gap-1">
        <Folder className="w-3 h-3" />
        Pasta (deixe vazio pra raiz)
      </label>
      <input
        list="folder-options"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="SJNET BACKBONE / NETFLOW / nova pasta..."
        className="w-full bg-bg-soft border border-border text-fg text-[13px] rounded px-2 py-1.5 font-mono focus:outline-none focus:border-accent-cyan focus:shadow-glow-blue placeholder:text-fg-dim"
      />
      <datalist id="folder-options">
        {options.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <p className="text-[10px] text-fg-dim mt-1 font-mono">
        Pode digitar nome novo de pasta — vai ser criada automaticamente.
      </p>
    </div>
  );
}
