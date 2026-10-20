// Bar Windows test pass. Never prints token values.
import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

const REPO = 'C:/Users/Steve/Desktop/Development/bar';
const S = 'C:/Users/Steve/AppData/Local/Temp/claude/C--Users-Steve/fe060094-ed0a-423f-ba14-1769bf598c86/scratchpad/bartest';
const CACHE = join(tmpdir(), 'bar-usage-cache.json');
const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '');
const results = [];
const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

function bar(input, { env = {}, shim = false } = {}) {
  const cmd = shim ? 'cmd.exe' : process.execPath;
  const args = shim ? ['/d', '/c', 'claude-wbar.cmd'] : [join(REPO, 'src/index.js')];
  const t0 = performance.now();
  const r = spawnSync(cmd, args, { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...env } });
  return { out: strip(r.stdout || ''), err: r.stderr || '', code: r.status, ms: performance.now() - t0 };
}
const clearCache = () => rmSync(CACHE, { force: true });
const fakeHome = (name, creds, config) => {
  const d = join(S, name); mkdirSync(d, { recursive: true });
  if (creds) writeFileSync(join(d, '.credentials.json'), JSON.stringify(creds));
  if (config) { mkdirSync(join(d, '.bar'), { recursive: true }); writeFileSync(join(d, '.bar', 'config.json'), JSON.stringify(config)); }
  return { CLAUDE_CONFIG_DIR: d, HOME: d, USERPROFILE: d };
};
const base = (cwd = REPO) => ({ model: { display_name: 'Opus 5.5' }, workspace: { current_dir: cwd, project_dir: cwd },
  cost: { total_lines_added: 12, total_lines_removed: 3 }, context_window: { context_window_size: 1_000_000, current_usage: { input_tokens: 50_000, cache_read_input_tokens: 30_000 } } });

rmSync(S, { recursive: true, force: true }); mkdirSync(S, { recursive: true });

// ── Rendering & real token ──
clearCache();
let r = bar(base(), { shim: true });
const lines = r.out.trim().split('\n');
rec('3 lines via npm .cmd shim', lines.length === 3 && r.code === 0 && !r.err, lines.join(' / '));
rec('context math (80k of 1M, auto-compact buffer)', /80k\/967k/.test(lines[0]) && /8%/.test(lines[0]), lines[0]);
rec('session % from live API', /\d+%.*\d+h \d+m|\d+m/.test(lines[1]), lines[1]);
rec('git branch + line counts', /windows-support.*\+12 -3/.test(lines[2]), lines[2]);

// ── Timing ──
const time = (n, cold) => { const ms = []; for (let i = 0; i < n; i++) { if (cold) clearCache(); ms.push(bar(base(), { shim: true }).ms); } ms.sort((a, b) => a - b); return { med: Math.round(ms[n >> 1]), max: Math.round(ms[n - 1]) }; };
const cold = time(5, true), warm = time(10, false);
rec('timing cold (API call each run)', cold.med < 1500, `median ${cold.med}ms, max ${cold.max}ms over 5 runs`);
rec('timing warm (30s usage cache)', warm.med < 500, `median ${warm.med}ms, max ${warm.max}ms over 10 runs`);
const direct = []; for (let i = 0; i < 10; i++) direct.push(bar(base()).ms); direct.sort((a, b) => a - b);
rec('timing warm, node direct (no .cmd shim)', true, `median ${Math.round(direct[5])}ms`);

// ── Git edge cases (throwaway repo, not the real one) ──
const g = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
const tr = join(S, 'repo'); mkdirSync(join(tr, 'sub', 'deep'), { recursive: true });
g(['init', '-q', '-b', 'main'], tr); writeFileSync(join(tr, 'a.txt'), 'a');
g(['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.'], tr); g(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'], tr);
r = bar(base(join(tr, 'sub', 'deep'))); rec('subdirectory not misread as worktree', /^⎇ main/m.test(r.out) && !/ᚰ/.test(r.out), r.out.trim().split('\n')[2]);
g(['worktree', 'add', '-q', '-b', 'feat/x', join(S, 'wt')], tr);
r = bar({ ...base(join(S, 'wt')), workspace: { current_dir: join(S, 'wt'), project_dir: join(S, 'wt') } });
rec('linked worktree indicator', /ᚰ wt.*⎇ feat\/x/.test(r.out), r.out.trim().split('\n')[2]);
g(['checkout', '-q', '--detach'], tr);
r = bar(base(tr)); rec('detached HEAD shows short hash', /⎇ [0-9a-f]{7}/.test(r.out), r.out.trim().split('\n')[2]);
const nogit = join(S, 'nogit'); mkdirSync(nogit);
r = bar(base(nogit)); rec('non-git folder hides git line', r.out.trim().split('\n').length === 2, `${r.out.trim().split('\n').length} lines`);
const sp = join(S, 'path with spaces & ünïcode'); mkdirSync(sp); g(['init', '-q', '-b', 'spaced'], sp);
r = bar(base(sp)); rec('path with spaces/unicode/&', /⎇ spaced/.test(r.out), r.out.trim().split('\n')[2] || '(no git line)');

// ── Line visibility config ──
clearCache();
r = bar(base(), { env: fakeHome('cfg', { claudeAiOauth: { accessToken: 'x', expiresAt: 1 } }, { lines: { context: false, session: true, git: false } }) });
rec('~/.bar/config.json hides lines', r.out.trim().split('\n').length === 1 && /^Session/.test(r.out.trim()), r.out.trim());

// ── Failure states (fake creds) ──
for (const [name, creds, want] of [
  ['no credentials', null, 'Not signed in'],
  ['expired Claude Code token', { claudeAiOauth: { accessToken: 'x', expiresAt: 1000 } }, 'Not signed in'],
  ['rejected token (401)', { claudeAiOauth: { accessToken: 'fake', expiresAt: 9e12 } }, 'Not signed in'],
]) { clearCache(); r = bar(base(), { env: fakeHome(name.replace(/\W/g, ''), creds) }); rec(`${name} → "${want}", quiet`, r.out.includes(want) && !r.err && r.code === 0, r.out.trim().split('\n')[1]); }
clearCache();
r = bar(base(), { env: { HTTPS_PROXY: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9' } });
rec('network failure → quiet (proxy test, may not apply)', !r.err && r.code === 0, r.out.trim().split('\n')[1]);
r = bar('not json'); rec('garbage stdin → quiet', !r.err && r.code === 0, r.out.trim().split('\n')[0]);
r = bar(''); rec('empty stdin → quiet', !r.err && r.code === 0, `${r.out.trim().split('\n').length} lines`);

// ── Real-token resolution (names only) ──
clearCache();
const { resolveToken } = await import('file:///' + REPO + '/src/tokens.js');
const t = resolveToken();
rec('token resolves from Claude Code creds, no Bar login', t?.source === 'claude-code', `source=${t?.source}, length=${t?.accessToken?.length}`);
rec('no ~/.bar/tokens.json written (Bar never stored a token)', !existsSync(join(homedir(), '.bar', 'tokens.json')));

// ── Facts for the Battery port (shapes only, no values) ──
const credsPath = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), '.credentials.json');
const creds = JSON.parse(readFileSync(credsPath, 'utf8'));
const shape = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? 'array' : typeof v]));
const oauth = creds.claudeAiOauth;
const { request } = await import('file:///' + REPO + '/src/http.js');
const res = await request('https://api.anthropic.com/api/oauth/usage', { headers: { Authorization: `Bearer ${t.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'Bar/0.1.0' } });
const usage = JSON.parse(res.body);
const usageShape = Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : (v === null ? null : typeof v)]));
let ccVersion = ''; try { ccVersion = execFileSync('cmd.exe', ['/d', '/c', 'claude --version'], { encoding: 'utf8', stdio: 'pipe' }).trim(); } catch { ccVersion = 'not found on PATH'; }
const facts = {
  os: execFileSync('cmd.exe', ['/d', '/c', 'ver'], { encoding: 'utf8' }).trim(),
  node: process.version, git: g(['--version']).trim(), claudeCode: ccVersion,
  npmPrefix: execFileSync('cmd.exe', ['/d', '/c', 'npm prefix -g'], { encoding: 'utf8' }).trim(),
  tmpdir: tmpdir(), CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR || '(unset)',
  credentialsTopLevelKeys: Object.keys(creds), claudeAiOauthShape: shape(oauth),
  tokenMinutesLeft: Math.round((oauth.expiresAt - Date.now()) / 60000),
  usageApiStatus: res.status, usageApiShape: usageShape,
};
writeFileSync(join(S, '..', 'bar-results.json'), JSON.stringify({ results, facts }, null, 2));
console.log('\nFACTS', JSON.stringify(facts, null, 2));
clearCache();
try { g(['worktree', 'remove', '--force', join(S, 'wt')], tr); } catch {}
rmSync(S, { recursive: true, force: true });
console.log(`\n${results.filter(x => x.pass).length}/${results.length} passed`);
