import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { isLocalServiceUrl, locateServer, OfficePilotServer, parseReadyFile } from '../src/main/officepilot-server'

// a stand-in for `walioffice desktop`: behaves according to FAKE_MODE
const FAKE = `
const fs = require('node:fs')
const path = require('node:path')
const args = process.argv.slice(2)
const ready = args[args.indexOf('--ready-file') + 1]
const mode = process.env.FAKE_MODE
if (mode === 'crash') { process.stderr.write('boom: port in use\\n'); process.exit(3) }
if (mode === 'hang') { setInterval(() => {}, 1000) }
else {
  setTimeout(() => {
    fs.mkdirSync(path.dirname(ready), { recursive: true })
    fs.writeFileSync(ready, JSON.stringify({ port: 17860, url: 'http://127.0.0.1:17860/', token: 'tok', version: '0.1.0' }))
    if (mode === 'die-later') setTimeout(() => process.exit(7), 100)
  }, 50)
  process.stdin.on('end', () => process.exit(0))
  process.stdin.resume()
}
`

let dir = ''
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

function fakeServer(mode: string, readyTimeoutMs = 5000) {
  dir = mkdtempSync(join(tmpdir(), 'officepilot-server-'))
  const script = join(dir, 'fake.cjs')
  writeFileSync(script, FAKE)
  const server = new OfficePilotServer(
    { binary: process.execPath, cli: null },
    join(dir, 'data'),
    { ...process.env, FAKE_MODE: mode },
    {
      // node runs the script; the real binary takes the same arguments
      spawn: (cmd, args, options) =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('node:child_process').spawn(cmd, [script, ...args], options),
      log: () => {},
      pollMs: 20,
      readyTimeoutMs,
    },
  )
  return server
}

describe('parseReadyFile', () => {
  it('accepts a complete file and rejects partial ones', () => {
    expect(parseReadyFile('{"port":1,"token":"t"}')).toEqual({ port: 1, url: 'http://127.0.0.1:1/', token: 't', version: '' })
    expect(parseReadyFile('{"port":1}')).toBeNull()
    expect(parseReadyFile('{"port":1,"token":""}')).toBeNull()
    expect(parseReadyFile('{"po')).toBeNull()
  })
})

describe('locateServer', () => {
  const base = { resourcesPath: '/App.app/Contents/Resources', appPath: '/repo/suite/apps/shell' }
  it('prefers the env override, then the packaged copy, then the checkout', () => {
    const all = () => true
    expect(locateServer({ ...base, env: { OFFICEPILOT_SERVER_BIN: '/x/walioffice' }, isPackaged: true, exists: all })?.binary).toBe('/x/walioffice')
    expect(locateServer({ ...base, env: {}, isPackaged: true, exists: all })).toEqual({
      binary: '/App.app/Contents/Resources/officepilot/walioffice',
      cli: '/App.app/Contents/Resources/officepilot/officepilot',
    })
    expect(locateServer({ ...base, env: {}, isPackaged: false, exists: all })?.binary).toBe('/repo/server/target/release/walioffice')
  })
  it('is null for a plain suite build', () => {
    expect(locateServer({ ...base, env: {}, isPackaged: true, exists: () => false })).toBeNull()
    expect(
      locateServer({ ...base, env: {}, isPackaged: true, exists: (p) => p.endsWith('walioffice') })?.cli,
    ).toBeNull()
  })
})

describe('OfficePilotServer', () => {
  it('resolves with the ready file and stops cleanly', async () => {
    const server = fakeServer('ok')
    const info = await server.start()
    expect(info.token).toBe('tok')
    expect(server.current()?.port).toBe(17860)
    server.stop()
    expect(server.current()).toBeNull()
  })

  it('reports a service that exits before it is ready, with its stderr', async () => {
    const server = fakeServer('crash')
    await expect(server.start()).rejects.toThrow(/code 3.*port in use/)
    expect(server.error()).toMatch(/port in use/)
  })

  it('times out a service that never becomes ready', async () => {
    const server = fakeServer('hang', 300)
    await expect(server.start()).rejects.toThrow(/timed out/)
  })

  it('tells the shell when a ready service dies, but not when it is stopped', async () => {
    const server = fakeServer('die-later')
    const exited = new Promise<number | null>((resolve) => server.onUnexpectedExit(resolve))
    await server.start()
    expect(await exited).toBe(7)
    expect(server.current()).toBeNull()
  })

  it('limits restarts to three in five minutes', () => {
    const server = fakeServer('ok')
    expect([0, 1, 2, 3].map((i) => server.canRestart(1000 + i))).toEqual([true, true, true, false])
    expect(server.canRestart(1000 + 6 * 60_000)).toBe(true)
  })
})

describe('isLocalServiceUrl', () => {
  it('accepts only the loopback service', () => {
    expect(isLocalServiceUrl('http://127.0.0.1:17860/?settings=llm')).toBe(true)
    expect(isLocalServiceUrl('http://localhost:8010/')).toBe(true)
    expect(isLocalServiceUrl('https://example.com/')).toBe(false)
    expect(isLocalServiceUrl('file:///etc/passwd')).toBe(false)
    expect(isLocalServiceUrl('/tmp/probe.probe')).toBe(false)
  })
})

describe('assistant preload', () => {
  it('inlines the channel names it shares with the main process', async () => {
    const { readFileSync } = await import('node:fs')
    const { OFFICEPILOT_CHANNELS } = await import('../src/shared/officepilot-api')
    const preload = readFileSync(join(__dirname, '../src/preload/officepilot.ts'), 'utf8')
    // a sandboxed preload must not import shared modules (they become chunks it cannot load)
    expect(preload).not.toMatch(/from '\.\.\/shared\//)
    expect(preload).toContain(`'${OFFICEPILOT_CHANNELS.desktopInfo}'`)
    expect(preload).toContain(`'${OFFICEPILOT_CHANNELS.invoke}'`)
  })
})
