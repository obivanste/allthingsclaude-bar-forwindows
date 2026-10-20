# Handoff: test and finish the Windows port of Bar

You are Claude Code on a Windows 11 machine. Another Claude session on the owner's Mac did the groundwork. Your job is to test Bar on Windows and fix what breaks. Do not touch Battery yet.

## What Bar is
`allthingsclaude/bar` (by Marko Radak, github.com/markoradak) is a Node statusline for Claude Code (`claude-wbar` command). The owner's fork is `obivanste/allthingsclaude-bar-forwindows`, branch `windows-support`. Upstream is `allthingsclaude/bar`.

## State
- Windows support is already in the branch (commit 4e913b9): paths, git handling, and Bar no longer refreshes Battery's tokens.
- Pending, not yet pushed: a new read-only token source, `~/.claude/.credentials.json` (or `$CLAUDE_CONFIG_DIR`), checked last after env vars, `~/.bar/tokens.json` and `~/.battery/tokens/*.json`. Version 0.1.8. If it is not on the branch yet, the owner will tell you where the patch is.

## Verified facts about this PC (from an earlier check)
- Claude Code credentials are a plain file at `%USERPROFILE%\.claude\.credentials.json`, not Windows Credential Manager.
- Layout: `claudeAiOauth.accessToken`, `expiresAt` in milliseconds.
- The access token lasts about 8 hours and is refreshed only while Claude Code runs.
- Node and Git were NOT installed at that time. Install with: `winget install OpenJS.NodeJS.LTS Git.Git`, then reopen the terminal.

## Rules
- Never print token values. Show only lengths or the token source name.
- The setup wizard now installs this fork (not the original npm package), so it is safe to use once the branch has the sandbox changes. Until they are pushed, install the branch directly instead.
- Do not push to `allthingsclaude/bar`. Work on the owner's fork only, and bump `package.json` version on every push.
- Do not refresh Claude Code's or Battery's tokens. Their refresh tokens are single-use, so refreshing them signs those apps out.

## Test plan
1. `git clone https://github.com/obivanste/allthingsclaude-bar-forwindows` and check out `windows-support`, or `npm i -g github:obivanste/allthingsclaude-bar-forwindows#windows-support`.
2. Run `claude-wbar` with no login. It should resolve the Claude Code token.
3. Add `{"statusLine": {"type": "command", "command": "claude-wbar"}}` to `%USERPROFILE%\.claude\settings.json`, merging with existing content.
4. Restart Claude Code in a git repo. Check:
   - Do all three lines appear?
   - Does the session percentage show?
   - Is the git branch correct?
   - Does it feel laggy?
5. If the line is blank, run `where.exe claude-wbar` to see whether Claude Code can find the command.
6. After 8+ hours idle, confirm Bar fails quietly instead of printing errors.

## Report back
Summarize what passed, what failed, and any commits made, so the Mac session can plan the Battery port.
