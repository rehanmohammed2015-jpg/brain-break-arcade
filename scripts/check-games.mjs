// Runs on every pull request (see .github/workflows/check-games.yml).
// Checks that a student only changed their own game folder and that every game follows the rules.
// Reads its inputs from environment variables, never from the command line, so nothing in a pull request
// title or branch name can sneak into a shell command.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAMES_DIR, validateFolder, validateGameJson, foldersTouched, isText } from './rules.mjs';

const BASE = process.env.BASE_REF || 'main';
const AUTHOR = (process.env.PR_AUTHOR || '').toLowerCase();
const OWNER = (process.env.REPO_OWNER || '').toLowerCase();
const isOwner = AUTHOR && AUTHOR === OWNER;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const problems = [];
const notes = [];

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replace(/\\/g, '/');
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p));
    else out.push({ path: p, size: st.size, text: isText(p) ? readFileSync(p, 'utf8') : undefined });
  }
  return out;
}
function baseAuthor(id) {
  try { return JSON.parse(git('show', `origin/${BASE}:${GAMES_DIR}${id}/game.json`)).author || null; } catch (e) { return null; }
}

// 1. what did this pull request change?
const changed = git('diff', '--name-only', `origin/${BASE}...HEAD`).split('\n').filter(Boolean);
const { ids, outside } = foldersTouched(changed);
if (!isOwner) {
  if (outside.length) problems.push(`Only files inside your game folder (community/games/your-game/) can be changed. This pull request also changes: ${outside.slice(0, 8).join(', ')}${outside.length > 8 ? ' …' : ''}`);
  if (ids.length > 1) problems.push(`Please send one game per pull request. This one changes ${ids.length} game folders: ${ids.join(', ')}.`);
  if (ids.length === 0 && !outside.length) problems.push('This pull request doesn’t change any game folder.');
}

// 2. is it their game?
for (const id of isOwner ? [] : ids) {
  const before = baseAuthor(id);
  if (before && before.toLowerCase() !== AUTHOR) problems.push(`The game "${id}" belongs to @${before}. You can only change your own games. Pick a different folder name for a new game.`);
  const path = `${GAMES_DIR}${id}/game.json`;
  if (existsSync(path)) {
    try {
      const a = String(JSON.parse(readFileSync(path, 'utf8')).author || '').toLowerCase();
      if (a !== AUTHOR) problems.push(`In ${id}/game.json, "author" must be your own GitHub username (@${process.env.PR_AUTHOR}).`);
    } catch (e) { /* reported below */ }
  }
}

// 3. does every game follow the rules?
const gameIds = existsSync(GAMES_DIR) ? readdirSync(GAMES_DIR).filter(n => statSync(GAMES_DIR + n).isDirectory()) : [];
for (const id of gameIds) {
  const files = listFiles(GAMES_DIR + id);
  const errs = validateFolder(id, files);
  const gj = files.find(f => f.path === `${GAMES_DIR}${id}/game.json`);
  if (gj) errs.push(...validateGameJson(gj.text, id).errors);
  if (errs.length) problems.push(...errs.map(e => `**${id}**: ${e}`));
  else if (ids.includes(id)) notes.push(`✅ **${id}** follows all the rules.`);
}

// 4. report, in the pull request's checks page
const report = problems.length
  ? `## ❌ A few things to fix\n\n${problems.map(p => `- ${p}`).join('\n')}\n\nFix them in your fork, then commit again. This check runs again by itself.`
  : `## ✅ Your game passed the checks\n\n${notes.join('\n')}\n\nYour teacher will now play it and read the code. If they approve it, it goes live in the arcade.`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
process.exit(problems.length ? 1 : 0);
