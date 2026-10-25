#!/usr/bin/env node
// Brand check for the OfficePilot fork (OfficePilot modification of GenOffice, Apache-2.0).
// Fails when the upstream product name or logo can still reach a user:
//   - "GenOffice" in UI strings, help, HTML, CLI help, skills or packaging metadata
//   - "Genspark" in the in-app help (the Genspark sign-in is removed in this fork)
//   - the upstream logo asset or app ids still referenced by the build
//   - "Genspark" in a UI string that can render while the Genspark account is
//     disabled (only the keys in GATED_KEYS may still name it), Genspark sign-in
//     wording in prompts and CLI help, and the upstream onboarding (GenTeam
//     credits offer, "first open-source" claim, upstream app icon)
//
//   node tools/check-officepilot-brand.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SKIP = new Set(['node_modules', '.git', 'out', 'dist', 'target', 'coverage', 'tests'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(ROOT).map((f) => relative(ROOT, f))

// i18n keys that still name Genspark but only render with GENSPARK_ACCOUNT_ENABLED
// (apps/shell/src/shared/officepilot.ts) or are not referenced at all
const GATED_KEYS = new Set([
  // shell home and settings: account button, cloud projects, account pane, Genspark provider hints
  'navCloud',
  'cloudSubtitle',
  'cloudLoginHint',
  'accountGenspark',
  'loginGenspark',
  'loggedInGenspark',
  'loginNetworkError',
  'setAiGensparkHint',
  'setAiMediaGensparkHint',
  'setAiSearchGensparkHint',
  'setAiGskTools',
  'setAiGskToolsDesc',
  // editors: inline sign-in button (never set) and the unused account strings
  'aiGskLoginBtn',
  'aiGensparkAccount',
  'aiNotLoggedIn',
  'aiLoginGenspark',
  'appGensparkAccount',
  'appNotLoggedIn',
  'appLoginGenspark',
  'appSettingsAccount',
  'appSettingsLoggedOut',
  'appSettingsLogin',
  // main-process errors: errGskNotLoggedIn is unused
  'errGskNotLoggedIn',
])
const HIDDEN_PROVIDER_CATALOGS = new Set([
  'packages/ai-provider/src/providers.ts',
  'packages/ai-provider/src/media.ts',
  'packages/ai-provider/src/search-settings.ts',
])
const dictionary = (rel) =>
  /^apps\/[^/]+\/src\/renderer\/(.*\/)?(i18n\/(?!help\/)|strings\.ts$)/.test(rel) ||
  /^apps\/(slides\/src\/main\/i18n-main|docs\/src\/main\/docs-main|sheets\/src\/main\/sheets-main)\.ts$/.test(
    rel,
  )
const problems = []

const visible = (rel) =>
  /^apps\/[^/]+\/src\/renderer\/.*\.(ts|tsx|html|md)$/.test(rel) ||
  /^apps\/[^/]+\/src\/(main|preload)\/.*\.ts$/.test(rel) ||
  /^packages\/[^/]+\/src\/.*\.(ts|tsx|md)$/.test(rel) ||
  /^skills\/.*\.md$/.test(rel) ||
  /^apps\/shell\/electron-builder\.cjs$/.test(rel) ||
  /^apps\/[^/]+\/package\.json$/.test(rel)

for (const rel of files) {
  if (!visible(rel)) continue
  const text = readFileSync(join(ROOT, rel), 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    // attribution lines (Apache-2.0 NOTICE) are required, not branding
    if (/Apache-2\.0|OfficePilot modification/.test(line)) return
    if (
      /(?<!\^)\bGenOffice\b(?! \[| \/| (?:Sans|Serif|PUA|Batang|Songti|Gothic|Box|SimSun|Hiragino|Grid|Myungjo|Poppins|DM|Bengali|Tamil|MS|Fullwidth|YaHei|UI Kana|Hangul|Che|MingLiU|Heiti|Ethiopic)\b)/.test(
        line,
      )
    )
      problems.push(`${rel}:${i + 1}: GenOffice`)
    if (/\/i18n\/help\//.test(rel) && /Genspark/.test(line))
      problems.push(`${rel}:${i + 1}: Genspark in help`)
    // the editors' AI assistant carries the OfficePilot name and mark, not Genspark's
    if (
      /(>|"|')Genspark AI(<|"|')|(aiPanelTitle|ribbonAiAssistant): 'Genspark'|M105\.115 0H24\.6428|^\s+Genspark\s*$/.test(
        line,
      )
    )
      problems.push(`${rel}:${i + 1}: Genspark assistant name or mark`)
    if (/\/i18n\/help\//.test(rel) && /genspark/i.test(line) && !/Genspark/.test(line))
      problems.push(`${rel}:${i + 1}: genspark in help`)
    // a Genspark-naming UI string must belong to a key that cannot render in this fork
    // (dictionary entries only: `key: '…'` or a quoted value line under `key:`)
    const key =
      dictionary(rel) && /genspark/i.test(line)
        ? (line.match(/^\s*'?([\w-]+)'?\s*:\s*['"`]/) ??
            (/^\s*['"`]/.test(line) ? lines[i - 1]?.match(/^\s*'?([\w-]+)'?\s*:\s*$/) : null))?.[1]
        : undefined
    if (key && !GATED_KEYS.has(key)) problems.push(`${rel}:${i + 1}: Genspark in UI string ${key}`)
    // prompts, tool descriptions and CLI help: no Genspark sign-in or credits wording
    // (the hidden Genspark provider's own catalog entries are exempt: HIDDEN_PROVIDER_IDS)
    if (
      !dictionary(rel) &&
      !HIDDEN_PROVIDER_CATALOGS.has(rel) &&
      !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line) &&
      /(signed out of|sign(ed)? in (to|with)|check the) Genspark|Genspark (login|sign-in|credits|only)|1,000\+/.test(
        line,
      )
    )
      problems.push(`${rel}:${i + 1}: Genspark sign-in or credits wording`)
    // upstream onboarding: GenTeam credits offer and GenOffice's "first open-source" claim
    if (
      /onbCredits|onbJoinGenTeam|openGenTeam|\bGenTeam\b|first open-source|第一个开源|第一個開源/.test(
        line,
      )
    )
      problems.push(
        `${rel}:${i + 1}: upstream onboarding (GenTeam offer or "first open-source" claim)`,
      )
    // the editors never offer a Genspark sign-in after a failed run
    if (/loginRequired: true/.test(line))
      problems.push(`${rel}:${i + 1}: Genspark sign-in button after a failed run`)
    if (/aria-label=\{t\('aiGensparkAccount'\)\}/.test(line))
      problems.push(`${rel}:${i + 1}: Genspark account label`)
    // the Genspark cloud tools switch only renders with the Genspark account
    if (
      /t\('setAiGskTools'\)\}<\/div>/.test(line) &&
      !lines.slice(Math.max(0, i - 8), i).some((l) => /GENSPARK_ACCOUNT_ENABLED &&/.test(l))
    )
      problems.push(
        `${rel}:${i + 1}: Genspark cloud tools switch not gated by GENSPARK_ACCOUNT_ENABLED`,
      )
  })
}

const builder = readFileSync(join(ROOT, 'apps/shell/electron-builder.cjs'), 'utf8')
if (/com\.genoffice\.app/.test(builder))
  problems.push('apps/shell/electron-builder.cjs: appId com.genoffice.app')
if (files.some((f) => /genoffice-logo\.svg$/.test(f)))
  problems.push('upstream logo asset genoffice-logo.svg still present')
// the upstream two-squares app icon (onboarding, update dialog) is replaced by officepilot-mark.svg
if (files.includes('apps/shell/src/renderer/src/assets/app-icon.png'))
  problems.push('upstream app icon apps/shell/src/renderer/src/assets/app-icon.png still present')
for (const rel of [
  'apps/shell/src/renderer/src/Onboarding.tsx',
  'apps/shell/src/renderer/update.html',
]) {
  if (/app-icon\.png/.test(readFileSync(join(ROOT, rel), 'utf8')))
    problems.push(`${rel}: still uses the upstream app icon`)
}
// the CLI launchers start the app binary, which carries the product name
for (const rel of ['packages/cli/bin/genoffice', 'packages/cli/bin/genoffice.cmd']) {
  if (/GenOffice(\.exe)?"/.test(readFileSync(join(ROOT, rel), 'utf8')))
    problems.push(`${rel}: launcher still starts the upstream GenOffice binary`)
}
if (/@genspark\/cli/.test(builder))
  problems.push(
    'apps/shell/electron-builder.cjs: the Genspark CLI (gsk) must not ship in this fork',
  )
if (files.some((f) => f.startsWith('ee/')))
  problems.push('ee/ (GenOffice Enterprise License) must not ship in this fork')

if (problems.length) {
  console.error(`brand check failed (${problems.length}):\n${problems.slice(0, 80).join('\n')}`)
  process.exit(1)
}
console.log('brand check passed')
