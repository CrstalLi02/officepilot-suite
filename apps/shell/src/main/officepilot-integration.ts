/**
 * OfficePilot modification of GenOffice (Apache-2.0): wires the OfficePilot service into the
 * shell — starts it, answers the assistant tab's desktop hooks, keeps a tray icon so
 * background work (tasks, schedules, Feishu) continues with every window closed, and stops
 * the service when the app quits.
 */
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app, dialog, ipcMain, Menu, nativeImage, shell, Tray, type BrowserWindow } from 'electron'

import { OFFICEPILOT_CHANNELS, type OfficePilotStatus } from '../shared/officepilot-api'
import { locateServer, OfficePilotServer, type OfficePilotInfo } from './officepilot-server'

/** same directory the earlier Tauri desktop app used, so existing data carries over;
 *  OFFICEPILOT_DATA_ROOT points a test or second install somewhere else */
export function officePilotDataRoot(): string {
  return process.env.OFFICEPILOT_DATA_ROOT || join(app.getPath('appData'), 'com.officepilot.desktop')
}

/** the variable the suite's custom endpoint reads its key from (OfficePilot's suite_ai) */
const KEY_ENV = 'OFFICEPILOT_SUITE_LLM_KEY'
const KEY_REFRESH_MS = 30_000

export interface OfficePilotDeps {
  shellWindow: () => BrowserWindow | null
  revealShellWindow: () => void
  openAssistantTab: (url: string) => void
  isAssistantWebContents: (webContentsId: number) => boolean
  tm: (key: 'trayShow' | 'trayQuit' | 'assistantTab' | 'officepilotStartFailed', params?: Record<string, string>) => string
}

let server: OfficePilotServer | null = null
let tray: Tray | null = null
let keyTimer: NodeJS.Timeout | null = null

function serviceEnv(cli: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  env.OFFICEPILOT_EMBEDDED = '1'
  // the suite's own model settings file (the "use OfficePilot's model" switch edits it)
  env.OFFICEPILOT_SUITE_SETTINGS = join(app.getPath('userData'), 'ai-settings.json')
  // the suite command line (used by the service to open files here) finds this running
  // instance's control socket through it, whatever userData this instance uses
  env.GENOFFICE_USER_DATA = app.getPath('userData')
  if (cli) env.OFFICEPILOT_CLI = cli
  if (app.isPackaged && process.platform === 'darwin') {
    // .app/Contents/MacOS/<exe> → .app: the service runs the suite command line on this app
    env.OFFICEPILOT_SUITE_APP = join(dirname(process.execPath), '..', '..')
  } else if (!app.isPackaged) {
    env.OFFICEPILOT_SUITE_CLI = join(app.getAppPath(), '..', '..', 'packages', 'cli', 'bin', 'genoffice')
  }
  return env
}

/** pass the model key to this process (the editors' AI reads it) while sharing is on */
async function refreshSharedKey(info: OfficePilotInfo): Promise<void> {
  try {
    const res = await fetch(new URL('api/editor/ai-sync/key', info.url), {
      headers: { Authorization: `Bearer ${info.token}` },
    })
    const body = res.ok ? ((await res.json()) as { key?: string | null }) : null
    if (body?.key) process.env[KEY_ENV] = body.key
    else delete process.env[KEY_ENV]
  } catch {
    // service restarting; keep the last value until the next round
  }
}

function inDataRoot(path: string): string | null {
  try {
    const target = realpathSync(path)
    const root = realpathSync(officePilotDataRoot())
    return target === root || target.startsWith(root + (process.platform === 'win32' ? '\\' : '/')) ? target : null
  } catch {
    return null
  }
}

function installTray(deps: OfficePilotDeps): void {
  if (tray) return
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.icns')
    : join(app.getAppPath(), 'build', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  tray = new Tray(icon)
  tray.setToolTip('OfficePilot')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: deps.tm('trayShow'), click: () => deps.revealShellWindow() },
      {
        label: deps.tm('assistantTab'),
        click: () => {
          const info = server?.current()
          if (!info) return
          deps.revealShellWindow()
          deps.openAssistantTab(info.url)
        },
      },
      { type: 'separator' },
      { label: deps.tm('trayQuit'), click: () => app.quit() },
    ]),
  )
}

async function startService(deps: OfficePilotDeps, announce: boolean): Promise<void> {
  if (!server) return
  try {
    const info = await server.start()
    await refreshSharedKey(info)
    if (keyTimer) clearInterval(keyTimer)
    keyTimer = setInterval(() => {
      const current = server?.current()
      if (current) void refreshSharedKey(current)
    }, KEY_REFRESH_MS)
  } catch (err) {
    console.error('[officepilot] service failed to start:', err)
    if (announce) {
      const win = deps.shellWindow()
      const options = {
        type: 'warning' as const,
        message: deps.tm('officepilotStartFailed', { error: err instanceof Error ? err.message : String(err) }),
      }
      void (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options))
    }
  }
}

/** start the service when this build ships it; a plain suite build runs as before */
export function installOfficePilot(deps: OfficePilotDeps): void {
  const location = locateServer({
    env: process.env,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  })

  ipcMain.handle(OFFICEPILOT_CHANNELS.status, (): OfficePilotStatus => {
    const info = server?.current() ?? null
    return { available: !!location, running: !!info, version: info?.version ?? '', error: server?.error() ?? null }
  })
  ipcMain.handle(OFFICEPILOT_CHANNELS.openAssistant, (_event, path: unknown) => {
    const info = server?.current()
    if (!info) return
    const target = new URL(typeof path === 'string' && path.startsWith('/') ? path : '/', info.url)
    deps.openAssistantTab(target.toString())
  })
  // the assistant tab's page only: its token and desktop hooks
  ipcMain.on(OFFICEPILOT_CHANNELS.desktopInfo, (event) => {
    const info = server?.current()
    event.returnValue =
      info && deps.isAssistantWebContents(event.sender.id)
        ? { token: info.token, version: info.version, dataDir: officePilotDataRoot() }
        : null
  })
  ipcMain.handle(OFFICEPILOT_CHANNELS.invoke, async (event, cmd: unknown, args: unknown) => {
    if (!deps.isAssistantWebContents(event.sender.id)) throw new Error('not allowed')
    const path = (args as { path?: unknown } | null)?.path
    switch (cmd) {
      case 'reveal_path': {
        const target = typeof path === 'string' ? inDataRoot(path) : null
        if (!target) throw new Error('只能打开 OfficePilot 数据目录里的文件')
        shell.showItemInFolder(target)
        return null
      }
      case 'open_path': {
        const target = typeof path === 'string' ? inDataRoot(path) : null
        if (!target) throw new Error('只能打开 OfficePilot 数据目录里的文件')
        const error = await shell.openPath(target)
        if (error) throw new Error(error)
        return null
      }
      case 'pick_folder': {
        const win = deps.shellWindow()
        const picked = win
          ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
          : await dialog.showOpenDialog({ properties: ['openDirectory'] })
        return picked.canceled ? null : (picked.filePaths[0] ?? null)
      }
      default:
        throw new Error(`unknown command ${String(cmd)}`)
    }
  })

  if (!location) {
    console.log('[officepilot] no service binary in this build; running as the editor suite only')
    return
  }
  server = new OfficePilotServer(location, officePilotDataRoot(), serviceEnv(location.cli))
  server.onUnexpectedExit(() => {
    if (server?.canRestart()) setTimeout(() => void startService(deps, false), 2000)
  })
  installTray(deps)
  void startService(deps, true)
}

/** closing the last window leaves the app in the tray while the service runs */
export function officePilotKeepsRunning(): boolean {
  return tray !== null
}

/** app quit: stop the service with the app */
export function stopOfficePilot(): void {
  if (keyTimer) clearInterval(keyTimer)
  keyTimer = null
  server?.stop()
  tray?.destroy()
  tray = null
}
