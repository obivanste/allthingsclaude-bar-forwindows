import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const CACHE_TTL = 5; // seconds

function cachePath(cwd) {
  const hash = createHash('md5').update(cwd).digest('hex');
  return join(tmpdir(), `bar-git-cache-${hash}.json`);
}

function readCache(path) {
  try {
    const stat = statSync(path);
    if (Date.now() - stat.mtimeMs < CACHE_TTL * 1000) {
      return JSON.parse(readFileSync(path, 'utf8'));
    }
  } catch {}
  return null;
}

// execFile, not execSync: no shell in between, which on Windows saves a cmd.exe
// spawn per call. Process creation is slow enough there to make every call count.
function run(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Get git info for a directory. Returns { branch, worktree } or null.
 */
export function getGitInfo(cwd) {
  if (!cwd) return null;

  const cp = cachePath(cwd);
  const cached = readCache(cp);
  if (cached) return cached;

  // One call answers both "is this a repo" and "is this a linked worktree"
  const dirs = run(['rev-parse', '--git-dir', '--git-common-dir'], cwd);
  if (!dirs) return null;
  // From a subdirectory git reports --git-dir absolute but --git-common-dir
  // relative (`../.git`), so compare resolved paths or every subdir reads as a worktree
  const [gitDir, gitCommon] = dirs.split('\n').map(d => resolve(cwd, d));
  const worktree = gitDir !== gitCommon;

  const branch = run(['branch', '--show-current'], cwd) || run(['rev-parse', '--short', 'HEAD'], cwd);

  const info = { branch, worktree };
  try { writeFileSync(cp, JSON.stringify(info)); } catch {}
  return info;
}
