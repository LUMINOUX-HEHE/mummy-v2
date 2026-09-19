# Unified Studio — one project, three parts connected

`dsh` is the hub. `open-design` drives it. `awesome-catalog` extends it.

```
┌─────────────┐      dsh --profile open-design --stdio (JSONL)      ┌──────────────┐
│ OpenDesign  │ ───────────────────────────────────────────────────▶ │ DeepSeek     │
│ web+daemon  │ ◀── --probe / --models (catalog, session resume) ─── │ Harness      │
└─────────────┘                                                     │ (dsh-base)   │
       ▲                                                            └──────────────┘
       │                                                                   ▲
       │ od agent setup deepseek-harness                                   │ dsh plugin add <tgz>
       │ installs packages/dsh-runtime bundle                              │
┌──────────────┐                                                  ┌──────────────────┐
│ OD bridge    │                                                  │ Awesome catalog  │
│ open-design/ │                                                  │ 3852 dsh.bundle  │
│ packages/    │                                                  │ data/plugins/*.yml│
│ dsh-runtime/ │                                                  └──────────────────┘
│ cordis.patch.yml                                                     │
└──────────────┘                                                     │
       └────────────────── both install into same DSH_HOME ──────────┘
```

## Layout (no file moves, no deep merge)

```
Downloads/deepseek-harness-master/   <- outer folder (your download)
  deepseek-harness-master/           <- DSH engine (MIT), do not restructure
  open-design-main/                  <- OD UX + daemon (Apache-2.0)
  awesome-dsh-plugin-main/data/      <- 3852 plugin descriptors (CC0)
  unified/                           <- THIS project: entrypoint + wiring (you are here)
    package.json
    scripts/paths.mjs                <- single source of truth for locations
    scripts/setup-bridge.mjs         <- build + install OD bridge into DSH
    scripts/verify.mjs               <- read-only connection check
    scripts/install-awesome.mjs      <- install one Awesome plugin into DSH
    .dsh-home/                       <- shared DSH_HOME (isolated from ~/.dsh)
```

Why not merge `apps/web` + `apps/web`? Both repos have one. Why not one lockfile?
`open-design` wants pnpm 10.33 / Node ~24, `dsh` wants pnpm 11.7 / Node ^22.19||>=24,
with conflicting `allowBuilds` / `onlyBuiltDependencies`. Keep two lockfiles until
both are green on one toolchain. `unified/` orchestrates, it does not re-bundle.

## Prereqs

- Node 24.x (`node --version` → v24.x, you have v24.11.1)
- pnpm (you have 10.28.1 — fine for now; don't mix 10/11 in one install)
- `DEEPSEEK_API_KEY` in env for any real model run (probe/models don't need it)

## Quickstart (in order)

```powershell
cd unified

# 1. read-only check — no installs, no mutations
npm run verify
# or: node ./scripts/verify.mjs

# 2. install deps (heavy, run once per subtree)
npm run install:all

# 3. build DSH engine
npm run build:dsh

# 4. build OD bridge + install into shared DSH_HOME
#    equivalent of: od agent setup deepseek-harness, but against LOCAL dsh
npm run setup:bridge

# 5. install one Awesome plugin into the same profile (example)
npm run plugin:add -- 00080000__dsh-project-memory
# usage: node ./scripts/install-awesome.mjs <plugin-key> [--profile open-design]

# 6. run
npm run dev:dsh   # DSH web UI
npm run dev:od    # OD web+daemon (select DeepSeek Harness as agent)
```

## Env (all optional, all have local defaults)

See `.env.example`. The only one that matters:

- `DSH_HOME` — defaults to `unified/.dsh-home`. Both DSH and OD must see the SAME
  value, otherwise OD creates `~/.dsh/profiles/open-design` and DSH looks elsewhere.
- `DSH_BIN` — defaults to `dsh` on PATH. If you built from source without global
  install, point it at your built CLI or use `pnpm --dir ../deepseek-harness-master exec dsh`.

`scripts/paths.mjs` resolves everything; scripts never hardcode `C:\...` paths.

## What "connected" means here (code refs)

- OD→DSH spawn: `open-design-main/apps/daemon/src/runtimes/defs/deepseek-harness.ts`
  (`bin: 'dsh'`, `buildArgs: ['--profile','open-design','--stdio']`,
  `streamFormat: 'dsh-profile-jsonl'`).
- OD bridge bundle: `open-design-main/packages/dsh-runtime/cordis.patch.yml`
  + `src/` (adds `--probe` / `--models` / `--stdio` on top of `dsh-base`).
- DSH plugin seam: `dsh plugin --profile <name> add <tgz>` (every Awesome entry
  is a `dsh.bundle`; every OD bridge build output is one too).
- Profile dir resolved by OD as `$DSH_HOME/profiles/open-design`
  (`resolveOpenDesignProfileDir` in the same def file).

## Licenses (kept separate, as required)

- `../deepseek-harness-master/LICENSE` (MIT)
- `../open-design-main/LICENSE` (Apache-2.0)
- `../awesome-dsh-plugin-main/LICENSE` (CC0-1.0)

`unified/` itself carries no license header — it is glue scripts only.
