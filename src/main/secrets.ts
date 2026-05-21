import { safeStorage } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = "ssh-launcher";

// Storage cross-platform:
// - Primário: Electron.safeStorage (Keychain no Mac, DPAPI Win, libsecret Linux)
// - Fallback no Mac: /usr/bin/security do ssh-launcher legacy (compat com Renan)
//
// Senhas guardadas como base64 do ciphertext na própria sessions.json no campo
// `encryptedPassword`. Quando vem do Keychain legacy, a app lê e re-encripta via
// safeStorage na próxima save.

export function isSafeStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptPassword(plain: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const buf = safeStorage.encryptString(plain);
  return buf.toString("base64");
}

export function decryptPassword(encrypted: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return null;
  }
}

// Legacy keychain (apenas Mac): pra retro-compat com a base de senhas do
// ssh-launcher antigo. Não é gravado mais (só lido como fallback).
export async function getKeychainPasswordLegacy(
  sessionPath: string
): Promise<string | null> {
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await execFileAsync("/usr/bin/security", [
      "find-generic-password",
      "-s",
      KEYCHAIN_SERVICE,
      "-a",
      `${sessionPath}:Password V2`,
      "-w",
    ]);
    return stdout.replace(/\n$/, "");
  } catch {
    return null;
  }
}

export async function keychainHasPasswordLegacy(
  sessionPath: string
): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  try {
    await execFileAsync("/usr/bin/security", [
      "find-generic-password",
      "-s",
      KEYCHAIN_SERVICE,
      "-a",
      `${sessionPath}:Password V2`,
    ]);
    return true;
  } catch {
    return false;
  }
}
