import { app, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Edita sempre em userData (cross-platform, writable).
// Lê de userData → SecureCRT (Mac compat) → bundled resources (default).
function userKeywordsDir() {
  return path.join(app.getPath("userData"), "keywords");
}

function getReadPaths(): string[] {
  const paths: string[] = [userKeywordsDir()];
  if (process.platform === "darwin") {
    paths.push(
      path.join(
        os.homedir(),
        "Library/Application Support/VanDyke/SecureCRT/Config/Keywords"
      )
    );
  }
  const rp = (process as any).resourcesPath;
  if (rp) paths.push(path.join(rp, "keywords"));
  paths.push(path.join(__dirname, "..", "..", "resources", "keywords"));
  return paths;
}

export interface KeywordRule {
  id: string;
  pattern: string;
  color: string; // #RRGGBB
  bold: boolean;
  enabled: boolean;
  file: "Cisco Words.ini" | "Lab Highlights.ini";
}

const LINE_RE =
  /^"((?:[^"\\]|\\.)*)",([0-9a-fA-F]{8}),([0-9a-fA-F]{8}),([0-9a-fA-F]{8})$/;

function bgrToHex(hex: string): string {
  const v = parseInt(hex, 16);
  const b = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const r = v & 0xff;
  return `#${[r, g, b]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function hexToBgr(hex: string): string {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return "00FFFFFF";
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  // COLORREF: 0x00BBGGRR
  return (
    "00" +
    [b, g, r]
      .map((n) => n.toString(16).padStart(2, "0").toUpperCase())
      .join("")
  );
}

async function findFile(filename: string): Promise<string | null> {
  for (const dir of getReadPaths()) {
    const c = path.join(dir, filename);
    try {
      await fs.access(c);
      return c;
    } catch {}
  }
  return null;
}

async function readKeywordFile(
  filename: KeywordRule["file"]
): Promise<KeywordRule[]> {
  const filepath = await findFile(filename);
  const rules: KeywordRule[] = [];
  if (!filepath) return rules;
  try {
    let raw = await fs.readFile(filepath, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    let idx = 0;
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s.startsWith('"')) continue;
      const m = s.match(LINE_RE);
      if (!m) continue;
      const [, pattern, colHex, boldHex, enabledHex] = m;
      if (pattern.startsWith("[*]")) continue;
      if (pattern === ".*|setasregextosetdefaultcolor") continue;
      rules.push({
        id: `${filename}::${idx++}`,
        pattern,
        color: bgrToHex(colHex),
        bold: parseInt(boldHex, 16) !== 0,
        enabled: parseInt(enabledHex, 16) !== 0,
        file: filename,
      });
    }
  } catch {
    /* file missing */
  }
  return rules;
}

async function writeKeywordFile(
  filename: KeywordRule["file"],
  rules: KeywordRule[]
): Promise<void> {
  const lines: string[] = [];
  lines.push("[*] Editado pelo SJNET NOC");
  for (const r of rules.filter((rr) => rr.file === filename)) {
    const enabledHex = r.enabled ? "00000001" : "00000000";
    const boldHex = r.bold ? "00000001" : "00000000";
    const colorHex = hexToBgr(r.color);
    lines.push(`"${r.pattern}",${colorHex},${boldHex},${enabledHex}`);
  }
  // Sempre escreve em userData (writable + cross-platform)
  const dir = userKeywordsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), lines.join("\n") + "\n", "utf-8");
}

export function registerKeywordHandlers() {
  ipcMain.handle("keywords:load", async () => {
    const cisco = await readKeywordFile("Cisco Words.ini");
    const lab = await readKeywordFile("Lab Highlights.ini");
    return [...cisco, ...lab];
  });

  ipcMain.handle("keywords:save", async (_evt, rules: KeywordRule[]) => {
    await writeKeywordFile("Cisco Words.ini", rules);
    await writeKeywordFile("Lab Highlights.ini", rules);
    return true;
  });
}
