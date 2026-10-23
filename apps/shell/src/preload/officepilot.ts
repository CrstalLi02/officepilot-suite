/**
 * OfficePilot modification of GenOffice (Apache-2.0): preload for the assistant tab, which
 * shows the OfficePilot web UI served by the local OfficePilot service. It gives that page
 * the same desktop hooks the earlier Tauri shell injected:
 *
 * - window.__OFFICEPILOT_DESKTOP__ — the local user's token (auto sign-in), version, data dir
 * - window.__TAURI_INTERNALS__.invoke — reveal_path / open_path / pick_folder, answered by
 *   the shell (paths are confined to the OfficePilot data directory there)
 *
 * The main process answers these only for the assistant tab's own page.
 */
import { contextBridge, ipcRenderer } from 'electron'

// Inlined from ../shared/officepilot-api (keep in sync): a sandboxed preload cannot load
// chunks, and importing a module the main preload also imports splits it into one.
const DESKTOP_INFO = 'officepilot:desktop-info'
const INVOKE = 'officepilot:invoke'

const info = ipcRenderer.sendSync(DESKTOP_INFO) as {
  token: string
  version: string
  dataDir: string
} | null

if (info) {
  contextBridge.exposeInMainWorld('__OFFICEPILOT_DESKTOP__', info)
  contextBridge.exposeInMainWorld('__TAURI_INTERNALS__', {
    invoke: (cmd: string, args?: Record<string, unknown>) =>
      ipcRenderer.invoke(INVOKE, cmd, args ?? {}),
  })
}
