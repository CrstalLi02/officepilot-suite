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
- `apps/shell/electron-builder.cjs` — the Genspark CLI (`@genspark/cli`, "gsk") is no longer copied into the installer; search, image and media features use the providers configured in settings.
- `apps/shell/src/main/index.ts` — account status and sign-in IPC report signed-out / refuse while disabled.
- `apps/shell/src/preload/index.ts` — the Genspark provider is filtered out of the model, media and search pickers.
- `apps/shell/src/renderer/src/SettingsModal.tsx` — no account section; settings open on the AI model pane; About shows the license attribution.
- `apps/shell/src/renderer/src/Home.tsx` — the account button only opens settings.
- `packages/ai-provider/src/providers.ts`, `search-settings.ts` — defaults: DeepSeek (user's own key), keyless Parallel search, cloud tools off.
- `apps/docs/src/main/docs-main.ts`, `apps/sheets/src/main/sheets-main.ts`, `apps/slides/src/main/ai-ipc.ts` — a missing model key is reported as such instead of asking to sign in to Genspark.
- In-app help (`apps/shell/src/renderer/src/i18n/help/topics/*.md`) — sections about the Genspark account removed in every locale (`tools/officepilot-rebrand.mjs`); `help-registry.ts` no longer lists "genspark" as a search keyword.
- `apps/docs/src/renderer/ai/AiPanel.tsx`, `apps/sheets/src/renderer/App.tsx`, `apps/slides/src/renderer/ai/AiPanel.tsx` — a failed AI run no longer adds a "Sign in to Genspark" button (it appeared whenever no model key was set, because the provider then falls back to `genspark`).
- `apps/shell/src/renderer/src/KbAskPanel.tsx`, `strings.ts` (`askNeedsLogin`) — the knowledge-base chat asks for a model API key instead of a Genspark sign-in, in every locale.
- `apps/shell/src/renderer/src/SettingsModal.tsx` — the "Genspark cloud tools" switch and the Genspark provider hints only render with the Genspark account; `setAiByokNote` no longer says web search uses the Genspark sign-in, in every locale.
- `aiCreditsExhausted` (docs, sheets, slides, html, markdown, pdf) — the credits error names the user's model provider instead of Genspark credits and genspark.ai/pricing, in every locale.
- `apps/slides/src/main/i18n-main.ts` (`errGskCli`), `packages/ai-search/src/media-tools.ts` — image and media tools without a provider say to add one under Settings (AI Media & Search) instead of "gsk login".
- `apps/sheets/src/renderer/ai/AiChatPanel.tsx`, `i18n/ai/*.ts` — the AI panel resizer is labelled `aiPanelTitle` (OfficePilot) instead of "Genspark account".
- Agent prompts and tool descriptions (`docs-skill.ts`, `markdown-skill.ts`, `pdf-skill.ts`, `slides-skill.ts`, `packages/pipelines/src/slides/guides/design.md`), `packages/ai-provider/src/media-protocols.ts`, CLI help (`packages/cli/src/commands/image.ts`, `media.ts`, `search.ts`) and `apps/sheets/src/preload/index.ts` — no Genspark sign-in or Genspark-only wording.

## Privacy and system changes

- `apps/shell/src/main/analytics.ts` — usage analytics hard-disabled.
- `apps/shell/electron-builder.cjs` — never injects the upstream update feed, analytics keys or font catalog; `OFFICEPILOT_UPDATE_URL` may point at a feed this fork owns.
- `apps/shell/src/main/cli-link.ts` — the command line is no longer linked into `PATH` silently at launch.

## Branding

- `tools/officepilot-rebrand.mjs` — rewrites user-visible product names ("GenOffice" → "OfficePilot"; earlier passes used "OfficePilot Suite"), the typed command (`genoffice` → `officepilot-suite`) and upstream links across UI strings, help, main-process dialogs, CLI help, skills, packaging metadata and their tests. Internal identifiers (`@genoffice/*` packages, env vars, `genoffice://` resources) are unchanged.
- `tools/check-officepilot-brand.mjs` — fails the build if upstream branding reaches a user-visible surface, including a UI string naming Genspark outside the keys that only render with the Genspark account, Genspark sign-in or credits wording in prompts and CLI help, and the upstream onboarding.
- First-run onboarding (`apps/shell/src/renderer/src/Onboarding.tsx`, `onboarding.css`, `strings.ts`) — no GenTeam group chat or "1,000+ Genspark credits" offer, no "first open-source, AI-native office suite" claim (GenOffice's), and a note that AI usage is billed by the user's own model provider, in every locale. The `openGenTeam` IPC is removed (`src/main/index.ts`, `src/preload/index.ts`, `src/shared/home-api.ts`).
- `apps/shell/src/renderer/src/assets/officepilot-mark.svg` replaces the upstream app icon (`app-icon.png`, removed) in the onboarding and the update dialog (`update.html`).
- Product name `OfficePilot`, app id `com.officepilot.desktop` (the OfficePilot desktop app this build replaces), Linux executable `officepilot-suite`, maintainer / vendor, icons (`apps/*/build/icon*`), logo (`officepilot-logo.svg` replaces the upstream logo).
- `packages/cli/src/install.ts` — the command on `PATH` is `officepilot-suite`.
- `packages/cli/bin/genoffice`, `genoffice.cmd` — the packaged launchers start the `OfficePilot` binary (they still pointed at the upstream `GenOffice` binary and fell back to a system Node).
- `skills/genoffice/SKILL.md` — skill name `officepilot-suite`.
- `README.md` — rewritten for the fork; the original README is kept in `docs/UPSTREAM-README.md`.

## OfficePilot desktop app

The shell is the OfficePilot desktop app: the editors plus the OfficePilot service (assistant, workspace, tasks, schedules, plugins) running beside it.

- `apps/shell/src/main/officepilot-server.ts` — starts the service (`walioffice desktop`) as a background process, reads its port and token from a ready file (0600), restarts it after an unexpected exit (at most three times in five minutes); the service exits when the shell does.
- `apps/shell/src/main/officepilot-integration.ts` — data directory shared with the earlier OfficePilot desktop app, tray icon (closing every window keeps background work running), the assistant tab's desktop hooks (confined to the OfficePilot data directory), the shared model key for the editors' AI.
- `apps/shell/src/preload/officepilot.ts`, `src/shared/officepilot-api.ts` — the assistant tab's preload and IPC.
- `apps/shell/src/main/tab-manager.ts`, `src/shared/tabs-api.ts`, `tab-menu.ts`, `tab-lifecycle.ts`, `tab-document-actions.ts`, `mcp/tools/open-documents-tools.ts`, `src/renderer/src/TabBar.tsx` — an `assistant` tab kind (not a document) that shows the OfficePilot UI served locally.
- `apps/shell/src/renderer/src/Home.tsx`, `SettingsModal.tsx`, `strings.ts`, `src/main/index.ts` — an Assistant entry in the home sidebar and a settings pane linking to the assistant's own settings, in every locale.
- `apps/shell/electron-builder.cjs` — ships the service and the `officepilot` command line in `Resources/officepilot/` when `OFFICEPILOT_BIN_DIR` is set.

