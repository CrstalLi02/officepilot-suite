# OfficePilot Suite

OfficePilot Suite is the desktop editor suite bundled with [OfficePilot](https://github.com/CrstalLi02/OfficePilot): Docs, Sheets, Slides, PDF, Markdown and HTML editors that open and save real `.docx`, `.xlsx` and `.pptx` files, plus a command line and MCP server for coding agents.

**It is a modified version of [GenOffice](https://github.com/genspark-ai/genoffice) by Mainfunc, Inc.**, used under the Apache License 2.0. Almost all of the editor code is GenOffice's work. The changes made for OfficePilot are listed in [OFFICEPILOT_CHANGES.md](OFFICEPILOT_CHANGES.md); the original README is kept at [docs/UPSTREAM-README.md](docs/UPSTREAM-README.md).

GenOffice and Genspark are trademarks of Mainfunc, Inc. This fork does not use their names or logos as its own branding, and it is not affiliated with or endorsed by Mainfunc, Inc.

## What differs from upstream

- Product name, app id, icons and the command on `PATH` are OfficePilot Suite / `officepilot-suite`.
- No Genspark account: sign-in, credits, cloud projects and the hosted model proxy are not offered. AI features use the model service and key you configure.
- No usage analytics, no upstream update feed, no hosted font catalog, and no silent `PATH` changes.
- The `ee/` directory (GenOffice Enterprise License) is not included.

## Build

Requirements: Node.js 22.12+, npm 10+, Rust (for the Sheets `.xlsx` sidecar).

```bash
npm ci
npm run native:build -w @genoffice/sheets   # xlsx sidecar
npm run build:all
npm test
node tools/check-officepilot-brand.mjs        # no upstream branding left in user-visible surfaces
```

After merging upstream changes, run `node tools/officepilot-rebrand.mjs` and the brand check again.

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party components are listed in `THIRD-PARTY-NOTICES.txt`, generated at packaging time by `npm run notices`.
