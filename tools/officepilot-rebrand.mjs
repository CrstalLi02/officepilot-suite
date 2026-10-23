#!/usr/bin/env node
// OfficePilot rebrand pass (OfficePilot modification of GenOffice, Apache-2.0).
//
// The GenOffice and Genspark names and logos are trademarks of Mainfunc, Inc.
// and are not licensed under Apache-2.0, so every user-visible surface of this
// fork carries the OfficePilot name instead (the editors are the OfficePilot desktop app;
// earlier passes used "OfficePilot Suite", which the first rule below folds in). Internal identifiers that
// users never see (npm scope @genoffice/*, module names, env vars, the
// genoffice:// resource scheme) stay as they are to keep upstream merges cheap.
//
// The pass is idempotent: run it again after every upstream merge, then
// `node tools/check-officepilot-brand.mjs` to verify nothing slipped through.
//
//   node tools/officepilot-rebrand.mjs [--dry-run]

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DRY = process.argv.includes('--dry-run')

export const PRODUCT = 'OfficePilot'
export const COMMAND = 'officepilot-suite'
export const REPO = 'CrstalLi02/officepilot-suite'

const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'dist', 'build-output', 'target', 'coverage'])
// JSON is left alone except package.json metadata (generated tables key fonts by name)
const TEXT_EXT = /(\.(ts|tsx|mts|cts|js|mjs|cjs|html|md|css|xml|yml|yaml|nsh|desktop|txt)|package\.json)$/

// Files that must keep the upstream names: license / attribution records and this tooling.
const KEEP = [
  /^LICENSE$/,
  /^NOTICE$/,
  /^OFFICEPILOT_CHANGES\.md$/,
  /^README\.md$/,
  /^tools\/officepilot-/,
  /^tools\/check-officepilot-brand\.mjs$/,
  /^tools\/gen-third-party-notices\.mjs$/,
  /^package-lock\.json$/,
  /^docs\/i18n\//,
  /^CONTRIBUTING\.md$/,
  /^SECURITY\.md$/,
  /^PRIVACY\.md$/,
  /^\.github\//,
  // word-count fixtures use the upstream name as sample text
  /^apps\/docs\/tests\/(selection-)?word-count\.test\.ts$/,
]

/** Surfaces a user can see: renderer UI, main-process dialogs / menus / titles, CLI output and help, packaging metadata, skills. */
const SCOPES = [/^apps\/[^/]+\/src\//, /^apps\/[^/]+\/package\.json$/, /^apps\/shell\/electron-builder\.cjs$/, /^apps\/shell\/build\/[^/]+\.(nsh|desktop)$/, /^packages\/[^/]+\/src\//, /^packages\/cli\//, /^skills\//, /^packaging\//, /^apps\/[^/]+\/tests\//, /^packages\/[^/]+\/tests\//]

/** Internal CSS font-family aliases: identifiers matched by font code, never shown as a product name. */
export const FONT_ALIASES = ['Hiragino Mincho', 'Hiragino Sans', 'SimSun Latin', 'Fullwidth TC', 'Hangul Space', 'Che Latin KR', 'Box Drawing', 'YaHei Latin', 'Grid Strut', 'UI Kana JP', 'PUA Blank', 'Songti SC', 'Songti TC', 'Gothic KR', 'MS Mincho', 'Serif KR', 'Hiragino', 'Heiti TC', 'Ethiopic', 'Sans KR', 'Myungjo', 'Poppins', 'DM Sans', 'Bengali', 'MingLiU', 'Batang', 'Tamil']

const RULES = [
  // earlier passes named the fork "OfficePilot Suite"; the app is now OfficePilot itself
  [/\bOfficePilot Suite\b/g, PRODUCT],
  [/\bOFFICEPILOT SUITE\b/g, 'OFFICEPILOT'],
  // product name in prose and UI strings; \b keeps identifiers such as GenOfficeConfig intact,
  // and the lookahead keeps the internal CSS font aliases ("GenOffice Sans KR", …) unchanged
  [new RegExp(`(?<!\\^)\\bGenOffice\\b(?! (?:${FONT_ALIASES.join('|')})\\b| \\[| \\/)`, 'g'), PRODUCT],
  [/\bGENOFFICE\b(?!_)/g, 'OFFICEPILOT'],
  // the command line users type
  [/\bnpx skills add genspark-ai\/genoffice\b/g, `npx skills add ${REPO}`],
  [/github\.com\/genspark-ai\/genoffice\b/g, `github.com/${REPO}`],
  // a command followed by a subcommand word or closing backtick; the lookbehind
  // skips scoped packages, paths, URLs and template interpolations
  // (not before a lowercase font-alias word, as in generated metric tables)
  [new RegExp(`(?<![@\\w/.:\${-])genoffice(?= (?!(?:${FONT_ALIASES.map((f) => f.toLowerCase().split(' ')[0]).join('|')})\\b)[a-z<-]| \\$\\{|\`)`, 'g'), COMMAND],
  // marketing site
  [/https:\/\/genoffice\.ai\/?[\w/-]*/g, `https://github.com/${REPO}`],
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (TEXT_EXT.test(name)) out.push(p)
  }
  return out
}

/**
 * In-app help still describes the Genspark account, which this fork removes:
 * drop sections whose heading mentions it, parentheticals that offer it as an
 * option, and any remaining line about it. Works the same in every locale.
 */
export function stripGensparkHelp(text) {
  const lines = text.split('\n')
  const out = []
  let skipLevel = 0
  for (const line of lines) {
    const heading = /^(#{1,6})\s/.exec(line)
    if (heading) {
      const level = heading[1].length
      if (skipLevel && level <= skipLevel) skipLevel = 0
      if (!skipLevel && /Genspark/.test(line)) {
        skipLevel = level
        continue
      }
    }
    if (skipLevel) continue
    const cleaned = line.replace(/\s*[(（][^()（）]*Genspark[^()（）]*[)）]/g, '')
    if (/Genspark/.test(cleaned)) continue
    out.push(cleaned)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** attribution lines (Apache-2.0 NOTICE) must keep naming GenOffice — same rule as the brand check */
const ATTRIBUTION = /Apache-2\.0|OfficePilot modification/

export function rebrandText(text) {
  return text
    .split('\n')
    .map((line) => {
      if (ATTRIBUTION.test(line)) return line
      let out = line
      for (const [re, to] of RULES) out = out.replace(re, to)
      return out
    })
    .join('\n')
}

function main() {
  let changed = 0
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file)
    if (KEEP.some((re) => re.test(rel))) continue
    if (!SCOPES.some((re) => re.test(rel))) continue
    const text = readFileSync(file, 'utf8')
    let next = rebrandText(text)
    if (/\/i18n\/help\/topics\/.*\.md$/.test(rel)) next = stripGensparkHelp(next)
    if (next !== text) {
      changed++
      if (!DRY) writeFileSync(file, next)
      else console.log(rel)
    }
  }
  console.log(`${DRY ? 'would change' : 'changed'} ${changed} files`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
