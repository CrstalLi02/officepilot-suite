/** OfficePilot modification of GenOffice (Apache-2.0): IPC between the shell and the OfficePilot service integration */
export const OFFICEPILOT_CHANNELS = {
  /** sync, assistant tab only: { token, version, dataDir } | null */
  desktopInfo: 'officepilot:desktop-info',
  /** assistant tab only: reveal_path / open_path / pick_folder */
  invoke: 'officepilot:invoke',
  /** home: is the service running, and where */
  status: 'officepilot:status',
  /** home: open the assistant tab at a path of the OfficePilot UI ('/' by default) */
  openAssistant: 'officepilot:open-assistant',
} as const

export interface OfficePilotStatus {
  /** this build ships the OfficePilot service */
  available: boolean
  /** the service is up */
  running: boolean
  version: string
  error: string | null
}
