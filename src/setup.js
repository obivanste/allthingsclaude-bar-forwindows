import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { saveConfig } from './config.js';
import { login } from './login.js';
import { resolveToken } from './tokens.js';
import { BRAND, DIM, RESET } from './colors.js';
import { multiSelect } from './prompts.js';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

function writeStatusLineConfig() {
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'));
  } catch {}

  settings.statusLine = {
    type: 'command',
    command: 'claude-bar',
  };

  mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export default async function setup() {
  console.log();
  console.log(`${BRAND}  bar${RESET} ${DIM}— battery-themed statusline for Claude Code${RESET}`);
  console.log();

  // Line visibility prompts
  const choices = await multiSelect([
    { label: 'Context line', default: true },
    { label: 'Session / rate-limit line', default: true },
    { label: 'Git line', default: true },
  ]);

  // Save config
  const config = {
    lines: {
      context: choices[0],
      session: choices[1],
      git: choices[2],
    },
  };
  saveConfig(config);
  console.log(`  ${DIM}Saved preferences to ~/.bar/config.json${RESET}`);

  // Install globally
  console.log(`\n  Installing globally...`);
  try {
    execSync('npm install -g github:obivanste/allthingsclaude-bar-forwindows', { stdio: 'inherit' });
  } catch {
    const fix = process.platform === 'win32'
      ? 'Try again from a terminal opened with "Run as administrator", or check that npm is on your PATH.'
      : 'You may need to run with sudo or fix npm permissions.';
    console.error(`\n  ${BRAND}Warning:${RESET} Global install failed. ${fix}`);
  }

  // Session/rate-limit data needs a token. Claude Code's own login is picked up
  // automatically, so only open the browser when nothing resolves.
  if (config.lines.session) {
    if (resolveToken()) {
      console.log(`\n  ${DIM}Using your existing Claude login, no sign-in needed.${RESET}`);
    } else {
      console.log(`\n  ${BRAND}Authenticating with Claude...${RESET}\n`);
      await login();
    }
  }

  // Write statusLine config to ~/.claude/settings.json
  writeStatusLineConfig();
  console.log(`\n  ${DIM}Configured statusLine in ~/.claude/settings.json${RESET}`);

  // Success
  console.log();
  console.log(`  ${BRAND}Setup complete!${RESET} Restart Claude Code to see your statusline.`);
  console.log();
}
