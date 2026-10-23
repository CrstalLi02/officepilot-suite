import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appBinaryForResources } from '../src/resources'

describe('appBinaryForResources', () => {
  it('finds the app in a custom Windows install directory', () => {
    expect(appBinaryForResources(join('D:\\Apps\\OfficePilot', 'resources'), 'win32')).toBe(
      join('D:\\Apps\\OfficePilot', 'OfficePilot.exe'),
    )
  })

  it('resolves the same binary for the default Windows install directory', () => {
    const localAppData = 'C:\\Users\\test\\AppData\\Local'
    const resources = join(localAppData, 'Programs', 'OfficePilot', 'resources')
    expect(appBinaryForResources(resources, 'win32')).toBe(
      join(localAppData, 'Programs', 'OfficePilot', 'OfficePilot.exe'),
    )
  })

  it('finds the app in a custom macOS bundle location', () => {
    expect(
      appBinaryForResources(join('/Volumes/Work/OfficePilot.app/Contents/Resources'), 'darwin'),
    ).toBe(join('/Volumes/Work/OfficePilot.app/Contents/MacOS/OfficePilot'))
  })

  it('finds the app in a custom Linux prefix', () => {
    expect(appBinaryForResources(join('/opt/genoffice-custom/resources'), 'linux')).toBe(
      join('/opt/genoffice-custom/genoffice'),
    )
  })
})
