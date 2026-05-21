# SJNET NOC

Premium SSH/Telnet client para engenharia de rede. Estética NOC dark com colorização Cisco em tempo real, monitor CPU/RAM, gerenciamento de sessões e backups.

## Features

- SSH + Telnet com algoritmos legacy (Cisco IOS antigo, MikroTik, Huawei VRP)
- Keyword highlighting Cisco em tempo real (Cisco Words.ini + Lab Highlights.ini)
- Multi-tab paralela, status bar com CPU/RAM do device, uptime, bytes in/out
- Editor de keywords (regex + cor + bold) embutido
- Senhas via Electron safeStorage (Keychain Mac, DPAPI Win, libsecret Linux)
- Import/Export de config com seleção granular
- Auto-update via GitHub Releases

## Download

Veja [Releases](https://github.com/theangelz/sjnet-noc/releases) pra baixar:
- **macOS**: `.dmg` (Intel) ou `.zip`
- **Windows**: `.exe` instalador ou portable
- **Linux**: `.AppImage`

## Development

```bash
npm install
npm run dev    # vite + electron em modo dev
```

## Build local

```bash
npm run dist:mac     # → release/*.dmg
npm run dist:win     # → release/*.exe (precisa Wine no Mac)
npm run dist:linux   # → release/*.AppImage
```

## Release automatizado

Push de tag `v*.*.*` dispara o workflow `.github/workflows/release.yml` que builda os 3 OSs em paralelo via Actions e publica no Releases.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Stack

Electron 33 · Vite 6 · React 18 · TypeScript · Tailwind · xterm.js · ssh2 · zustand
