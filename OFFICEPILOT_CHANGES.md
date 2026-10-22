# Changes made by OfficePilot

This repository is a modified version of GenOffice (https://github.com/genspark-ai/genoffice),
Copyright 2026 Mainfunc, Inc., licensed under the Apache License, Version 2.0.
As required by section 4(b) of the license, this file records the modifications.
Files changed by OfficePilot also carry an "OfficePilot modification" comment where the change is made.

Base: upstream commit 58dfd0b ("Sync snapshot (2026-10-22)").

## Removed

- `ee/` — reserved for the GenOffice Enterprise License, which does not apply to this fork.

## Genspark services

- `apps/shell/src/shared/officepilot.ts` — switches: Genspark account disabled, Genspark provider hidden.
- `apps/shell/src/main/index.ts` — account status and sign-in IPC report signed-out / refuse while disabled.
- `apps/shell/src/preload/index.ts` — the Genspark provider is filtered out of the model, media and search pickers.
- `apps/shell/src/renderer/src/SettingsModal.tsx` — no account section; settings open on the AI model pane; About shows the license attribution.
- `apps/shell/src/renderer/src/Home.tsx` — the account button only opens settings.
- `packages/ai-provider/src/providers.ts`, `search-settings.ts` — defaults: DeepSeek (user's own key), keyless Parallel search, cloud tools off.
- `apps/docs/src/main/docs-main.ts`, `apps/sheets/src/main/sheets-main.ts`, `apps/slides/src/main/ai-ipc.ts` — a missing model key is reported as such instead of asking to sign in to Genspark.
- In-app help (`apps/shell/src/renderer/src/i18n/help/topics/*.md`) — sections about the Genspark account removed in every locale (`tools/officepilot-rebrand.mjs`).

## Privacy and system changes

- `apps/shell/src/main/analytics.ts` — usage analytics hard-disabled.
- `apps/shell/electron-builder.cjs` — never injects the upstream update feed, analytics keys or font catalog; `OFFICEPILOT_UPDATE_URL` may point at a feed this fork owns.
- `apps/shell/src/main/cli-link.ts` — the command line is no longer linked into `PATH` silently at launch.

## Branding

- `tools/officepilot-rebrand.mjs` — rewrites user-visible product names ("GenOffice" → "OfficePilot Suite"), the typed command (`genoffice` → `officepilot-suite`) and upstream links across UI strings, help, main-process dialogs, CLI help, skills, packaging metadata and their tests. Internal identifiers (`@genoffice/*` packages, env vars, `genoffice://` resources) are unchanged.
- `tools/check-officepilot-brand.mjs` — fails the build if upstream branding reaches a user-visible surface.
- App id `com.officepilot.suite`, executable `officepilot-suite`, maintainer / vendor, icons (`apps/*/build/icon*`), logo (`officepilot-logo.svg` replaces the upstream logo).
- `packages/cli/src/install.ts` — the command on `PATH` is `officepilot-suite`.
- `skills/genoffice/SKILL.md` — skill name `officepilot-suite`.
- `README.md` — rewritten for the fork; the original README is kept in `docs/UPSTREAM-README.md`.
