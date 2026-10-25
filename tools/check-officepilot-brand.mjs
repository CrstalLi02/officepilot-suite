#!/usr/bin/env node
// Brand check for the OfficePilot fork (OfficePilot modification of GenOffice, Apache-2.0).
// Fails when the upstream product name or logo can still reach a user:
//   - "GenOffice" in UI strings, help, HTML, CLI help, skills or packaging metadata
//   - "Genspark" in the in-app help (the Genspark sign-in is removed in this fork)
//   - the upstream logo asset or app ids still referenced by the build
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
const problems = []

const visible = (rel) =>
  /^apps\/[^/]+\/src\/renderer\/.*\.(ts|tsx|html|md)$/.test(rel) ||
  /^apps\/[^/]+\/src\/main\/.*\.ts$/.test(rel) ||
  /^packages\/[^/]+\/src\/.*\.(ts|tsx|md)$/.test(rel) ||
  /^skills\/.*\.md$/.test(rel) ||
  /^apps\/shell\/electron-builder\.cjs$/.test(rel) ||
  /^apps\/[^/]+\/package\.json$/.test(rel)

for (const rel of files) {
  if (!visible(rel)) continue
  const text = readFileSync(join(ROOT, rel), 'utf8')
  text.split('\n').forEach((line, i) => {
    // attribution lines (Apache-2.0 NOTICE) are required, not branding
    if (/Apache-2\.0|OfficePilot modification/.test(line)) return
    if (/(?<!\^)\bGenOffice\b(?! \[| \/| (?:Sans|Serif|PUA|Batang|Songti|Gothic|Box|SimSun|Hiragino|Grid|Myungjo|Poppins|DM|Bengali|Tamil|MS|Fullwidth|YaHei|UI Kana|Hangul|Che|MingLiU|Heiti|Ethiopic)\b)/.test(line)) problems.push(`${rel}:${i + 1}: GenOffice`)
    if (/\/i18n\/help\//.test(rel) && /Genspark/.test(line)) problems.push(`${rel}:${i + 1}: Genspark in help`)
    // the editors' AI assistant carries the OfficePilot name and mark, not Genspark's
    if (/(>|"|')Genspark AI(<|"|')|(aiPanelTitle|ribbonAiAssistant): 'Genspark'|M105\.115 0H24\.6428|^\s+Genspark\s*$/.test(line))
      problems.push(`${rel}:${i + 1}: Genspark assistant name or mark`)
  })
}

const builder = readFileSync(join(ROOT, 'apps/shell/electron-builder.cjs'), 'utf8')
if (/com\.genoffice\.app/.test(builder)) problems.push('apps/shell/electron-builder.cjs: appId com.genoffice.app')
if (files.some((f) => /genoffice-logo\.svg$/.test(f))) problems.push('upstream logo asset genoffice-logo.svg still present')
// the CLI launchers start the app binary, which carries the product name
for (const rel of ['packages/cli/bin/genoffice', 'packages/cli/bin/genoffice.cmd']) {
  if (/GenOffice(\.exe)?"/.test(readFileSync(join(ROOT, rel), 'utf8'))) problems.push(`${rel}: launcher still starts the upstream GenOffice binary`)
}
if (/@genspark\/cli/.test(builder)) problems.push('apps/shell/electron-builder.cjs: the Genspark CLI (gsk) must not ship in this fork')
if (files.some((f) => f.startsWith('ee/'))) problems.push('ee/ (GenOffice Enterprise License) must not ship in this fork')

if (problems.length) {
  console.error(`brand check failed (${problems.length}):\n${problems.slice(0, 80).join('\n')}`)
  process.exit(1)
}
console.log('brand check passed')
