// Builds the website into _site/ before it is published (see .github/workflows/deploy.yml).
// Copies the arcade, adds every community game that follows the rules, writes community/games.json
// (the list the arcade reads), and adds a no-internet safety header to each game page.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GAMES_DIR, validateFolder, validateGameJson, injectCsp, isText } from './rules.mjs';

const OUT = '_site';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT + '/community/games', { recursive: true });
for (const f of ['index.html', 'community.js', 'games']) cpSync(f, join(OUT, f), { recursive: true });
writeFileSync(join(OUT, '.nojekyll'), '');

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
function addedDate(id) {
  try { return execFileSync('git', ['log', '--diff-filter=A', '--format=%cs', '-1', '--', `${GAMES_DIR}${id}/game.json`], { encoding: 'utf8' }).trim(); } catch (e) { return ''; }
}

const list = [];
const ids = existsSync(GAMES_DIR) ? readdirSync(GAMES_DIR).filter(n => statSync(GAMES_DIR + n).isDirectory()) : [];
for (const id of ids) {
  const files = listFiles(GAMES_DIR + id);
  const gj = files.find(f => f.path === `${GAMES_DIR}${id}/game.json`);
  const { errors, game } = gj ? validateGameJson(gj.text, id) : { errors: ['no game.json'] };
  errors.push(...validateFolder(id, files));
  if (errors.length) { console.warn(`Skipping ${id}:\n  ${errors.join('\n  ')}`); continue; }
  for (const f of files) {
    const dest = join(OUT, f.path);
    mkdirSync(join(dest, '..'), { recursive: true });
    if (f.path.endsWith('/index.html')) writeFileSync(dest, injectCsp(f.text));
    else cpSync(f.path, dest);
  }
  list.push(Object.assign(game, { added: addedDate(id) }));
}
list.sort((a, b) => (b.added || '').localeCompare(a.added || '') || a.title.localeCompare(b.title));
writeFileSync(join(OUT, 'community/games.json'), JSON.stringify({ games: list }, null, 2));
console.log(`Built the arcade with ${list.length} community game(s).`);
