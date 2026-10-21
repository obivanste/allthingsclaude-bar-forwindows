# Progress: Bar for Windows

Unofficial Windows port of [Bar](https://github.com/allthingsclaude/bar) by All Things Claude.
Companion to [Battery for Windows](https://github.com/obivanste/allthingsclaude-battery-forwindows).
Last updated 2026-10-21. Version 0.1.9.

## Status

Works on Windows 11. Every step of the handoff test plan passed, plus 21 automated checks (see
`handoff/windows-report-2026-10-20.md`). Not published to npm; installed from this repo.

## What was done

| Date | Commit | What |
|------|--------|------|
| 15 Oct | `4e913b9` | Windows support: paths and git handling. Bar stops refreshing Battery's tokens (refresh tokens are single-use, so rotating them would sign Battery out). |
| 20 Oct | `484462e` | Package renamed to `allthingsclaude-bar-forwindows`. Setup wizard installs this fork, not the npm original. New last-resort token source: Claude Code's own `%USERPROFILE%\.claude\.credentials.json` (or `CLAUDE_CONFIG_DIR`), read-only, never refreshed, expired tokens skipped. Version 0.1.8. |
| 20 Oct | `57ef60e` | From the Windows session: clearer Session line ("No active session", "Not signed in", "Usage unavailable"). On a 429 from the usage API, Bar honors `Retry-After` (60 s if absent), serves the last good data, and shares the backoff through the temp-dir cache so every Claude Code window backs off together. Version 0.1.9. |
| 20 Oct | `7172133` | Windows test report and the `handoff/` folder. |
| 21 Oct | `0906aa7` | Commands renamed back to `bar` and `claude-bar` (an earlier `wbar` variant was dropped so the port matches upstream). Package name unchanged. |
| 21 Oct | `25677e9` | Setup skips the browser login when a token already resolves. Install references point at the default branch. `.gitattributes` (`* text=auto eol=lf`) added. |

## Verified on Windows (from the test report)

- Token resolves from Claude Code's credentials file with no login; Bar never writes it.
- Live in Claude Code 2.1.304: all three lines, session percentage, correct git branch.
- Warm render about 145 ms median through the npm shim.
- Failures (no credentials, expired, rejected 401, network error, bad input) exit quietly.

## Open items

1. **Real 8-hour idle test.** Only simulated so far. Expect "Not signed in" until Claude Code refreshes its token.
2. **Rate limit.** The usage endpoint returned 429 with `retry-after: 282` after about 7 test calls in a few minutes. The real limit is unknown. Bar and Battery probably share it (unverified).
3. **Stale data is not marked** in Bar: while backing off, the countdown keeps running from old data.
4. **Upstream license.** Upstream has no `LICENSE` file (its README says MIT). A human needs to settle this with the author before the repo is shared. Keep it private until then.
5. **Windows clone remote URL** may still use the old `obivanste/bar` address. It redirects, so updating it is optional.
6. **Mac install is the original.** The `claude-bar` on the Mac is upstream's package, not this fork.

## Next

Battery for Windows reuses these findings (credentials file, rate-limit backoff, shared cache). See
its repo for design and prototype status.
