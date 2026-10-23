/**
 * OfficePilot modification of GenOffice (Apache-2.0): the OfficePilot desktop app is this
 * shell plus the OfficePilot service (workspace, assistant, tasks, schedules, plugins),
 * which runs as a background process:
 *
 *   walioffice desktop --data-root <dir> --ready-file <file> --exit-on-stdin-close
 *
 * The service writes its port and the local user's token into the ready file (0600)
 * once it listens; the shell reads that and never passes the token on the command line.
 * The service exits when its stdin closes, so it cannot outlive a crashed shell.
 * Without a service binary (a plain suite build) the shell runs as before.
 */
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface OfficePilotInfo {
  port: number
  url: string
  token: string
  version: string
}

export interface ServerLocation {
  /** the walioffice service binary */
  binary: string
  /** the officepilot command line shipped next to it (Settings → Integrations links it) */
  cli: string | null
}

const EXE = process.platform === 'win32' ? '.exe' : ''

/**
 * The service binary: OFFICEPILOT_SERVER_BIN, then Resources/officepilot/ in a packaged
 * app, then the OfficePilot checkout this suite is a submodule of (development).
 */
export function locateServer(opts: {
  env: NodeJS.ProcessEnv
  isPackaged: boolean
  resourcesPath: string
  appPath: string
  exists?: (path: string) => boolean
}): ServerLocation | null {
  const exists = opts.exists ?? existsSync
  const candidates: Array<[string, string]> = []
  if (opts.env.OFFICEPILOT_SERVER_BIN) {
    candidates.push([opts.env.OFFICEPILOT_SERVER_BIN, opts.env.OFFICEPILOT_CLI ?? ''])
  }
  if (opts.isPackaged) {
    const dir = join(opts.resourcesPath, 'officepilot')
    candidates.push([join(dir, `walioffice${EXE}`), join(dir, `officepilot${EXE}`)])
  } else {
    // apps/shell → suite → OfficePilot checkout
    const root = join(opts.appPath, '..', '..', '..')
    candidates.push([
      join(root, 'server', 'target', 'release', `walioffice${EXE}`),
      join(root, 'cli', 'target', 'release', `officepilot${EXE}`),
    ])
  }
  for (const [binary, cli] of candidates) {
    if (exists(binary)) return { binary, cli: cli && exists(cli) ? cli : null }
  }
  return null
}

/** OfficePilot modification: the OfficePilot service listens on loopback only */
export function isLocalServiceUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')
  } catch {
    return false
  }
}

/** the ready file the service writes; null until it is complete and well-formed */
export function parseReadyFile(text: string): OfficePilotInfo | null {
  try {
    const v = JSON.parse(text) as Partial<OfficePilotInfo>
    if (typeof v.port !== 'number' || typeof v.token !== 'string' || !v.token) return null
    return {
      port: v.port,
      url: typeof v.url === 'string' ? v.url : `http://127.0.0.1:${v.port}/`,
      token: v.token,
      version: typeof v.version === 'string' ? v.version : '',
    }
  } catch {
    return null
  }
}

export interface ServerDeps {
  spawn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess
  readFile?: (path: string) => string
  removeFile?: (path: string) => void
  log?: (message: string) => void
  pollMs?: number
  readyTimeoutMs?: number
}

export class OfficePilotServer {
  private child: ChildProcess | null = null
  private stopping = false
  private info: OfficePilotInfo | null = null
  private lastError: string | null = null
  private restarts: number[] = []
  private exitListener: ((code: number | null) => void) | null = null
  private readonly spawn: NonNullable<ServerDeps['spawn']>
  private readonly readFile: NonNullable<ServerDeps['readFile']>
  private readonly removeFile: NonNullable<ServerDeps['removeFile']>
  private readonly log: NonNullable<ServerDeps['log']>
  private readonly pollMs: number
  private readonly readyTimeoutMs: number

  constructor(
    private readonly location: ServerLocation,
    private readonly dataRoot: string,
    private readonly env: NodeJS.ProcessEnv,
    deps: ServerDeps = {},
  ) {
    this.spawn = deps.spawn ?? ((c, a, o) => nodeSpawn(c, a, o))
    this.readFile = deps.readFile ?? ((p) => readFileSync(p, 'utf8'))
    this.removeFile = deps.removeFile ?? ((p) => rmSync(p, { force: true }))
    this.log = deps.log ?? ((m) => console.log(`[officepilot] ${m}`))
    this.pollMs = deps.pollMs ?? 100
    this.readyTimeoutMs = deps.readyTimeoutMs ?? 60_000
  }

  get readyFile(): string {
    return join(this.dataRoot, 'run', 'server.json')
  }

  current(): OfficePilotInfo | null {
    return this.info
  }

  error(): string | null {
    return this.lastError
  }

  /** called when the service exits on its own (after it was ready) */
  onUnexpectedExit(listener: (code: number | null) => void): void {
    this.exitListener = listener
  }

  /** start the service and resolve once its ready file appears */
  start(): Promise<OfficePilotInfo> {
    this.stopping = false
    this.info = null
    this.removeFile(this.readyFile)
    const child = this.spawn(
      this.location.binary,
      ['desktop', '--data-root', this.dataRoot, '--ready-file', this.readyFile, '--exit-on-stdin-close'],
      { env: this.env, stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true },
    )
    this.child = child
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000)
    })
    return new Promise((resolve, reject) => {
      let settled = false
      const started = Date.now()
      const fail = (message: string) => {
        if (settled) return
        settled = true
        clearInterval(timer)
        this.lastError = message
        reject(new Error(message))
      }
      const timer = setInterval(() => {
        let info: OfficePilotInfo | null = null
        try {
          info = parseReadyFile(this.readFile(this.readyFile))
        } catch {
          // not written yet
        }
        if (info) {
          settled = true
          clearInterval(timer)
          this.info = info
          this.lastError = null
          this.log(`ready on ${info.url}`)
          resolve(info)
        } else if (Date.now() - started > this.readyTimeoutMs) {
          this.kill()
          fail(`timed out after ${Math.round(this.readyTimeoutMs / 1000)}s`)
        }
      }, this.pollMs)
      child.on('error', (err) => fail(err.message))
      child.on('exit', (code) => {
        if (this.child === child) this.child = null
        const wasReady = settled && this.info !== null
        this.info = null
        if (!settled) {
          fail(`exited with code ${code}${stderr.trim() ? `: ${stderr.trim().split('\n').slice(-3).join(' ')}` : ''}`)
          return
        }
        if (wasReady && !this.stopping) {
          this.lastError = `exited with code ${code}`
          this.log(this.lastError)
          this.exitListener?.(code)
        }
      })
    })
  }

  /** restart after an unexpected exit, at most 3 times in 5 minutes */
  canRestart(now = Date.now()): boolean {
    this.restarts = this.restarts.filter((t) => now - t < 5 * 60_000)
    if (this.restarts.length >= 3) return false
    this.restarts.push(now)
    return true
  }

  private kill(): void {
    const child = this.child
    if (!child) return
    child.stdin?.end()
    child.kill('SIGTERM')
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }, 3000)
    timer.unref?.()
  }

  /** stop the service (app quit); its ready file goes with it */
  stop(): void {
    this.stopping = true
    this.info = null
    this.kill()
    this.child = null
    this.removeFile(this.readyFile)
  }
}
