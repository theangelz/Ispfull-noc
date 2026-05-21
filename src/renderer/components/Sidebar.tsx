import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Server,
  Folder,
  Search,
  Plus,
  FolderPlus,
} from "lucide-react";
import { useStore } from "../store";
import type { SshSession } from "../../shared/types";

interface FolderNode {
  name: string;
  fullPath: string;
  children: FolderNode[];
  sessions: SshSession[];
}

function buildTree(sessions: SshSession[]): FolderNode {
  const root: FolderNode = {
    name: "/",
    fullPath: "",
    children: [],
    sessions: [],
  };
  for (const s of sessions) {
    const parts = s.folder.split("/").filter(Boolean);
    let node = root;
    let acc = "";
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      let child = node.children.find((c) => c.name === p);
      if (!child) {
        child = { name: p, fullPath: acc, children: [], sessions: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.sessions.push(s);
  }
  return root;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: "folder" | "session";
  folder?: string;
  session?: SshSession;
}

function TreeFolder({
  node,
  depth,
  query,
  expanded,
  toggle,
  onContextMenu,
}: {
  node: FolderNode;
  depth: number;
  query: string;
  expanded: Set<string>;
  toggle: (p: string) => void;
  onContextMenu: (
    e: React.MouseEvent,
    type: "folder" | "session",
    payload: { folder?: string; session?: SshSession }
  ) => void;
}) {
  const isRoot = node.name === "/";
  const isOpen = isRoot || expanded.has(node.fullPath) || query.length > 0;
  const { openTab } = useStore();

  return (
    <div>
      {node.name !== "/" && (
        <div
          onClick={() => toggle(node.fullPath)}
          onContextMenu={(e) =>
            onContextMenu(e, "folder", { folder: node.fullPath })
          }
          className="flex items-center gap-1 px-1 py-0.5 hover:bg-[rgba(0,150,255,0.08)] cursor-pointer text-fg-soft"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 shrink-0 text-accent-orange" />
          <span className="text-[12px] truncate font-medium">{node.name}</span>
        </div>
      )}
      {isOpen && (
        <>
          {node.children.map((c) => (
            <TreeFolder
              key={c.fullPath}
              node={c}
              depth={node.name === "/" ? 0 : depth + 1}
              query={query}
              expanded={expanded}
              toggle={toggle}
              onContextMenu={onContextMenu}
            />
          ))}
          {node.sessions
            .filter((s) =>
              query
                ? s.name.toLowerCase().includes(query.toLowerCase()) ||
                  s.host.toLowerCase().includes(query.toLowerCase())
                : true
            )
            .map((s) => (
              <div
                key={s.id}
                onDoubleClick={() => openTab(s)}
                onContextMenu={(e) =>
                  onContextMenu(e, "session", { session: s })
                }
                className="group flex items-center gap-1.5 px-1 py-0.5 hover:bg-[rgba(0,150,255,0.08)] cursor-pointer border-l-2 border-transparent hover:border-accent-blue"
                style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
                title={`${s.user}@${s.host}:${s.port}${s.hasPassword ? " (senha)" : ""}`}
              >
                <Server className="w-3.5 h-3.5 shrink-0 text-accent-cyan" />
                <span className="text-[12px] truncate text-fg">{s.name}</span>
                <span className="text-[10px] text-fg-dim ml-auto pr-1 group-hover:text-accent-cyan font-mono">
                  {s.host}
                </span>
              </div>
            ))}
        </>
      )}
    </div>
  );
}

export function Sidebar() {
  const { sessions, setSidebarSearchRef, openSessionForm, reloadSessions } =
    useStore();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tree = useMemo(() => buildTree(sessions), [sessions]);

  useEffect(() => {
    setSidebarSearchRef(inputRef);
  }, [setSidebarSearchRef]);

  // Fecha context menu ao clicar fora
  useEffect(() => {
    if (!ctxMenu) return;
    const onClick = () => setCtxMenu(null);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [ctxMenu]);

  const toggle = (p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!query) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        s.folder.toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const handleContextMenu = (
    e: React.MouseEvent,
    type: "folder" | "session",
    payload: { folder?: string; session?: SshSession }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type, ...payload });
  };

  const renameFolder = async (folder: string) => {
    const novo = prompt("Renomear pasta para:", folder);
    if (!novo || novo === folder) return;
    const n = await window.api.inventory.renameFolder({
      oldFolder: folder,
      newFolder: novo,
    });
    await reloadSessions();
    if (n === 0) alert("Nenhuma sessão movida (pasta não encontrada?)");
  };

  return (
    <aside className="w-[260px] shrink-0 bg-[#0c0c0c] border-r border-border-soft flex flex-col">
      <div className="p-2 border-b border-border-soft">
        <div className="relative">
          <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-fg-dim" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick connect..."
            className="w-full bg-bg-soft border border-border text-fg text-[12px] rounded pl-7 pr-2 py-1 focus:outline-none focus:border-accent-blue focus:shadow-glow-blue placeholder:text-fg-dim font-mono"
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-fg-dim font-mono uppercase tracking-wider">
          <span>Sessions</span>
          <span className="text-accent-cyan">
            {filtered.length} / {sessions.length}
          </span>
        </div>
      </div>

      <div className="flex border-b border-border-soft text-[11px]">
        <button
          onClick={() => openSessionForm("new")}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-accent-cyan hover:bg-accent-blue/10 transition-colors border-r border-border-soft"
          title="Nova sessão SSH"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova sessão</span>
        </button>
        <button
          onClick={() => {
            const folder = prompt("Nome da nova pasta:");
            if (folder?.trim()) {
              openSessionForm("new", undefined, folder.trim());
            }
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-accent-orange hover:bg-accent-orange/10 transition-colors"
          title="Nova pasta (cria com 1 sessão dentro)"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>Nova pasta</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 text-fg font-sans">
        <TreeFolder
          node={tree}
          depth={0}
          query={query}
          expanded={expanded}
          toggle={toggle}
          onContextMenu={handleContextMenu}
        />
      </div>
      <div className="border-t border-border-soft px-2 py-1.5 text-[10px] text-fg-dim font-mono">
        dbl-click abre · right-click edita
      </div>

      {ctxMenu && (
        <div
          className="fixed z-50 bg-bg-panel border border-border rounded shadow-2xl py-1 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.type === "session" && ctxMenu.session && (
            <>
              <CtxItem
                label="Abrir sessão"
                onClick={() => {
                  if (ctxMenu.session) useStore.getState().openTab(ctxMenu.session);
                  setCtxMenu(null);
                }}
              />
              <CtxItem
                label="Editar..."
                onClick={() => {
                  openSessionForm("edit", ctxMenu.session);
                  setCtxMenu(null);
                }}
              />
              <CtxItem
                label="Duplicar"
                onClick={() => {
                  const s = ctxMenu.session!;
                  window.api.inventory
                    .create({
                      name: `${s.name}-copy`,
                      folder: s.folder,
                      host: s.host,
                      port: s.port,
                      user: s.user,
                    })
                    .then(() => reloadSessions());
                  setCtxMenu(null);
                }}
              />
              <Divider />
              <CtxItem
                danger
                label="Apagar..."
                onClick={() => {
                  const s = ctxMenu.session!;
                  if (confirm(`Apagar "${s.name}"?`)) {
                    window.api.inventory.delete(s.id).then(() => reloadSessions());
                  }
                  setCtxMenu(null);
                }}
              />
            </>
          )}
          {ctxMenu.type === "folder" && ctxMenu.folder && (
            <>
              <CtxItem
                label="Nova sessão aqui"
                onClick={() => {
                  openSessionForm("new", undefined, ctxMenu.folder);
                  setCtxMenu(null);
                }}
              />
              <CtxItem
                label="Renomear pasta..."
                onClick={() => {
                  renameFolder(ctxMenu.folder!);
                  setCtxMenu(null);
                }}
              />
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function CtxItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[12px] ${
        danger
          ? "text-accent-red hover:bg-accent-red/10"
          : "text-fg hover:bg-bg-elevated hover:text-accent-cyan"
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-border-soft my-1" />;
}
