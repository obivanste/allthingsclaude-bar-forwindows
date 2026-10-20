# Bar on Windows: test report for the Mac session

Date: 2026-10-20 · Machine: Windows 11 Pro (10.0.22631.6199) · Branch: `windows-support`, version **0.1.9**

**Verdict: Bar works on Windows.** Every check in the handoff test plan passed, plus 21 extra automated checks. One new issue came up: **the usage API rate-limits (429)**. Bar now backs off when that happens, and it matters for the Battery port.

## Commits from the Windows session

- `57ef60e` Distinguish auth failures and back off on usage API rate limits (0.1.9). The code changes described below.
- The commit after it adds this `handoff/` folder.

They sit on top of `484462e` (the Mac's 0.1.8 commit), which the testing ran against. To get everything on the Mac: `git checkout windows-support && git pull`.

## What's in `handoff/`

| File | What it is |
|---|---|
| `windows-report-2026-10-20.md` | This report |
| `HANDOFF-windows.md` | The original brief from the Mac session, kept for context |
| `bar-test.mjs` | The automated test script. It prints no token values. Paths are hard-coded for the Windows PC. |
| `test-results.json` | Raw results plus environment facts: key names and types only, no secrets. |

## Handoff test plan results

| Step | Result |
|---|---|
| 1. Install | PASS. Installed with `npm i -g .` from the local clone. At that point the clone had the 0.1.8 changes uncommitted; they're identical to `484462e`. On Windows this creates a **symlink** from `%APPDATA%\npm\node_modules\allthingsclaude-bar-forwindows` to the clone, so edits take effect without reinstalling. Shims: `claude-wbar`, `.cmd`, `.ps1`. |
| 2. Run with no login | PASS. The token resolves from `claude-code` (`%USERPROFILE%\.claude\.credentials.json`). There's no `~/.bar` or `~/.battery` folder, and no env tokens are set. Bar never wrote `~/.bar/tokens.json`. |
| 3. `settings.json` | PASS. `statusLine` merged in; other keys kept. |
| 4. Live in Claude Code 2.1.304 | PASS. Confirmed by the owner's screenshot: all three lines, session %, correct branch, `+/-` counts. Context showed `78k/967k`, so Bar reads the 1M context window from Claude Code and subtracts the 33k auto-compact buffer. |
| 5. Blank line / `where.exe` | Not needed. `where.exe claude-wbar` finds the shims. |
| 6. Quiet failure after 8h idle | PASS, simulated. Expired, missing and rejected (401) tokens all exit 0 with nothing on stderr. The real 8h idle test hasn't been done. |

## Automated checks (21/21 pass)

- **Rendering:** all three lines through the npm `.cmd` shim; context math; live session %; git branch and line counts.
- **Git:** a subdirectory isn't misread as a worktree; the linked worktree indicator (`ᚰ wt │ ⎇ feat/x`) shows; detached HEAD shows a short hash; non-git folders hide the git line; paths with spaces, `&` and unicode work.
- **Config:** `~/.bar/config.json` line visibility is respected.
- **Failures:** no credentials, expired token, rejected token, network failure, garbage or empty stdin. All fail quietly.
- **Timing (warm, 30s usage cache):** median **145 ms** through the `.cmd` shim, 124 ms calling node directly. The shim costs about 20 ms, and nothing felt laggy live. Cold timings aren't reliable: the API was probably returning fast 429s during that run (see below).

## Change made in this session: clearer Session message

Before, every failure showed "No active session". Now the Session line shows one of three states:

| Situation | Session line |
|---|---|
| Signed in, no 5-hour window | No active session |
| No token, expired, or 401 after refresh attempt | **Not signed in** |
| Network or other API error (including 429) | **Usage unavailable** |

The change: `src/usage.js` makes `getUsage()` return `{ error: 'auth' }` for auth failures, and `src/render.js` picks the message. Failures aren't cached, so usage comes back on the next refresh once the token is good. Committed in `57ef60e`.

## New issue: the usage endpoint rate-limits (fixed in Bar)

During testing, `GET https://api.anthropic.com/api/oauth/usage` returned **429 `rate_limit_error` with `retry-after: 282`**. It was set off by about 7 test calls in a few minutes, on top of the live status line. I don't know the actual limit; I only saw it trip. The owner then saw "Session │ Usage unavailable" live in Claude Code.

What Bar used to do: successes were cached for 30s, but failures weren't cached and `Retry-After` was ignored, so every status line refresh called the API again while rate-limited.

**Fix (`src/usage.js`, commit `57ef60e`):** on a 429, Bar writes `_backoffUntil` (from `Retry-After`, or 60s if the header is missing) into the shared cache file. Until then it makes no API calls and serves the last good result. With no last good result, it shows "Usage unavailable". Because the cache file is in `%TEMP%`, every Claude Code window backs off together.

Tested: backoff with and without a last good result, an expired backoff, a fresh cache, and one real 429 (a 43s backoff was written to match the server's remaining wait). Once the backoff ran out, the next call got real data again (74%). Not shown: the cached numbers aren't marked stale. While backing off, the countdown keeps running from the old `resets_at`.

**This matters for Battery.** Bar and Battery hit the same endpoint with the same account's tokens, so if both poll, they probably share the same rate limit (unverified). Battery should poll less often, honour `Retry-After`, and ideally share one cache with Bar.

## Facts for the Battery port

- **Claude Code credentials on Windows:** a plain JSON file at `%USERPROFILE%\.claude\.credentials.json` (`CLAUDE_CONFIG_DIR` overrides the folder; it's unset here). It isn't in Windows Credential Manager.
  - Top-level keys: `mcpOAuth`, `claudeAiOauth`
  - `claudeAiOauth`: `accessToken` (string, 108 chars), `refreshToken` (string), `expiresAt` (number, ms), `refreshTokenExpiresAt` (number), `scopes` (array), `subscriptionType`, `rateLimitTier`, `subscriptionTypeSource` (strings)
  - **Never refresh from this file.** Refresh tokens are single-use, so refreshing would sign Claude Code out. Bar reads it but never writes it.
- **Usage API success shape** (from Bar's parser in `src/usage.js`, not re-captured today because of the 429): `five_hour` and `seven_day`, each `{ utilization (percent, float), resets_at }`, either of which can be null. The error shape is `{ error: { type, message } }`.
- **Environment:** Node v24.20.0, Git 2.55.0.windows.5, Claude Code 2.1.304, npm global prefix `%APPDATA%\npm`, temp dir `%LOCALAPPDATA%\Temp` (where Bar's `bar-usage-cache.json` and git caches go).
- **Windows quirks seen:**
  - `npm i -g <local dir>` makes a symlink, not a copy.
  - Commands run through `.cmd` shims, and calling `.cmd` files needs `cmd.exe` or shell spawning (Node's `spawn` won't run a `.cmd` file directly).
  - Git on this PC saw `src/index.js` as changed from 100755 to 100644 after editing. The Windows clone now has `core.fileMode=false`, so commits from it keep the executable bit. Any new Windows clone needs the same setting.
  - Global `core.autocrlf=true` and there's no `.gitattributes`, so files are stored as LF and checked out as CRLF on Windows. Commits stay LF. Adding a `.gitattributes` with `* text=auto eol=lf` would make that independent of each machine's config.

## Open items for the owner

1. **Remote URL:** resolved. `obivanste/bar` and `obivanste/allthingsclaude-bar-forwindows` return the same branch head, so the repo was renamed and the old URL redirects. The Windows clone still uses the old URL; updating it with `git remote set-url origin` is optional.
2. **Real 8h idle test:** still to do. Expect "Not signed in" until Claude Code is opened again and refreshes its token.
3. **Line endings:** consider adding `.gitattributes` (see Windows quirks above).
4. **Shared polling with Battery:** Bar now backs off on 429, but Battery should follow the same rule and ideally share one cache.
