# RUNBOOK — unified/ (DSH + OpenDesign + Awesome catalog)

Single entrypoint for the combined project. DSH is the engine, OpenDesign drives
it, the Awesome catalog extends it. Full background: `README.md`.

## Layout

```
Downloads/deepseek-harness-master/   <- outer folder
  deepseek-harness-master/           <- DSH engine source (MIT)
  open-design-main/                  <- OpenDesign UX + daemon (Apache-2.0)
  awesome-dsh-plugin-main/           <- 3852 plugin descriptors (CC0)
  unified/                           <- YOU ARE HERE (glue + state)
    package.json                     <- npm run scripts (below)
    scripts/                         <- setup-bridge / verify / install-awesome / paths
    .env                             <- DSH_HOME, DSH_PROFILE (never DSH_BIN!)
    .dsh-home/                       <- shared isolated Harness home (state, do not commit)
    dsh-web.log                      <- current server log (has the login URL)
    RUNBOOK.md                       <- this file
```

## Prerequisites

- Node 24.x (`node --version`)
- pnpm 10 or 11 (repo pins differ per subtree; both work for their own tree)
- At least one model key: `DEEPSEEK_API_KEY`, an Nvidia `nvapi-…` key,
  a Zhipu key, or any OpenAI-compatible endpoint. Probe/models need no key.

## First-time setup (once per machine)

```powershell
cd unified

# 1. Install deps per subtree (OD: use --ignore-scripts first; native builds need VS Build Tools)
pnpm --dir ../deepseek-harness-master install
pnpm --dir ../open-design-main install --ignore-scripts

# 2. Build the DSH engine (required — the server runs from lib/, see rule 1)
pnpm --dir ../deepseek-harness-master run build

# 3. Build the OpenDesign bridge + install into the shared open-design profile
$env:DSH_HOME="C:/Users/Sahil/Downloads/deepseek-harness-master/unified/.dsh-home"
$env:DSH_BIN="pnpm --dir C:/Users/Sahil/Downloads/deepseek-harness-master/deepseek-harness-master dsh"
node ./scripts/setup-bridge.mjs

# 4. Sanity check (read-only)
node ./scripts/verify.mjs

# 5. Optional: plugin market (every Awesome plugin one click away)
pnpm --dir ../deepseek-harness-master dsh plugin --profile open-design add dshmarket
```

## Everyday run

```powershell
cd unified
$env:DSH_HOME="C:/Users/Sahil/Downloads/deepseek-harness-master/unified/.dsh-home"

# Start (built launcher + in-app folder picker — see rules 1 and 3):
node ../deepseek-harness-master/apps/cli/lib/bin.js web `
  --patch ../deepseek-harness-master/apps/web/tests/pin-browse-picker.overlay.yml `
  --no-open
# or: npm run dev:dsh   (same command)

# Get the login URL (token is mandatory):
Get-Content ./dsh-web.log -Tail 2
# -> http://127.0.0.1:3080/?token=...

# Stop:
netstat -ano | findstr "127.0.0.1:3080"   # note the LISTENING PID
taskkill /PID <pid> /F
```

Model/provider setup is done **in the web UI** (Settings → providers), not in code.
Keys land in `.dsh-home/.credentials.yaml`. Model choice per session via the UI.

## Hard rules (learned the painful way)

1. **Always run the BUILT launcher** (`apps/cli/lib/bin.js` with plain `node`).
   Never `pnpm dsh` (tsx source launch) for real sessions: source mode loads
   two instances of the core tools module (`src/` via tsconfig paths + built
   `lib/`), their scheduler symbols differ, and **every** tool call dies with
   `Cannot read properties of undefined (reading 'prepare')`. Plain text keeps
   working, which makes it look random. It isn't.
2. **Never put `DSH_BIN` in `.env`.** DSH aborts boot with
   `"only the launching environment may set it"`. Export it in the shell.
   `DSH_HOME` in `.env` is fine.
3. **Windows folder picker needs the overlay patch** (`--patch …/pin-browse-picker.overlay.yml`).
   Without it, "Open folder" uses the native win32 dialog worker, which crashes
   with `directory picker failed … exited before reporting a result`.
4. **After ANY failed turn, start a NEW session.** A crashed turn can leave an
   orphaned `tool/call` with no `tool/result`; every later turn in that session
   then fails at the provider. Retry-in-place only works for *provider* errors
   (`PI_AI_ERROR` overloads leave calls/results balanced — those sessions live).
5. **After changing providers/models in Settings, restart the server.**
   The settings rewrite hot-reloads the long-running process and can split the
   same scheduler symbol as rule 1. Restart + new session = 60-second cure.
6. **Free endpoints overload; that's normal.** Nvidia shared endpoints and free
   HF endpoints return `Service temporarily overloaded` under load. It is NOT a
   quota hit (quota would be `RATE_LIMIT`/429). Retry, lower reasoning effort,
   split big prompts into small turns, or put $5 on DeepSeek official
   (~$0.15–0.30/M tokens: a 57K-token turn ≈ $0.01).
7. **Never send sensitive documents to anonymous free endpoints**
   (no-key HF endpoints = public). Keep PDR-type content on authenticated
   providers.

## npm scripts (`unified/package.json`)

| Script | What it does |
|---|---|
| `install:all` | `pnpm install` in both subtrees (heavy) |
| `build:dsh` | Build DSH engine (`run build`) |
| `build:bridge` | Build `@open-design/dsh-runtime` |
| `setup:bridge` | Build+pack bridge, install into `open-design` profile, `--probe` check. Needs `DSH_HOME`/`DSH_BIN` exported |
| `verify` | Read-only wiring check (paths, 3852 descriptors, `--probe`) |
| `plugin:add -- <key>` | Install one Awesome plugin, e.g. `00080000__dsh-project-memory` |
| `dev:dsh` | **Start server (built launcher + picker patch)** |
| `dev:dsh:source` | Source launch — broken for tools, kept for reference only |
| `dev:od` | OpenDesign tools-dev web (needs full native install) |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot read properties of undefined (reading 'prepare')` on every tool call | Dual tools-module instance (source launch, or stale HMR state) | Restart with built launcher (rule 1); new session (rule 4) |
| Same error right after Settings change | Hot-reload symbol split | Restart server + new session (rule 5) |
| `Service temporarily overloaded` / `PI_AI_ERROR` | Upstream provider capacity | Retry in same session; smaller turns; lower reasoning; different provider (rule 6) |
| `directory picker failed … win32 …` | Native folder dialog worker crash | Use `--patch` overlay (rule 3) |
| Boot error about `DSH_BIN` in `.env` | Forbidden var in file | Export in shell (rule 2) |
| `dsh` not recognized | No global install | Use `DSH_BIN` export form or run from DSH dir |
| Old session 400s forever | Orphaned `tool/call` | Abandon session, start new (rule 4) |
| Paused HF endpoint (`endpoint is paused`) | Community endpoint asleep | Nothing to fix; check back later or skip |

## Where state lives (all under `unified/.dsh-home/`)

- `profiles/web/` — the profile the web UI serves (clean, no `node_modules`)
- `profiles/open-design/` — OD bridge + market plugins live here
- `sessions/<workspace>/session-<id>/session.v3.jsonl.zstd` — durable log per session
  (decompress: `python decompress.py session.v3.jsonl.zstd out.jsonl` — needs `zstandard` pip package)
- `settings.yaml` — providers/models (written by UI)
- `.credentials.yaml` — keys (never commit, never paste publicly)
- `storages/workspace.json` — workspace roots
