/**
 * OfficePilot modification of GenOffice (Apache-2.0): OFFICEPILOT_USER_DATA keeps a test run's
 * editor settings, recent files and single-instance lock apart from the installed app's.
 * Imported first by index.ts, before any module can read userData.
 */
import { app } from 'electron'

if (process.env.OFFICEPILOT_USER_DATA) app.setPath('userData', process.env.OFFICEPILOT_USER_DATA)
