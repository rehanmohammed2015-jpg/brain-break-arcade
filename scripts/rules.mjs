// The rules every community game must follow. Plain functions with no Node or browser APIs,
// shared by check-games.mjs (runs on each pull request) and build-site.mjs (runs before publishing).
// Messages are written for students, so they say what to fix in plain words.

export const ICONS = ['🚀', '⚽', '🏀', '🧩', '🐉', '👾', '🏎️', '🎯', '🌋', '🐸', '🛸', '🏰', '🎸', '🧠', '⭐', '🍕'];
export const COLORS = ['dash', 'pop', 'math', 'memory', 'words', 'stack', 'gold', 'p1'];
export const CATEGORIES = ['arcade', 'sports', 'strategy', 'brain'];
export const GAME_ID = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;   // folder name: 3-40 chars, lowercase, digits, dashes
export const GITHUB_USER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export const GAMES_DIR = 'community/games/';

export const LIMITS = { files: 40, fileBytes: 2 * 1024 * 1024, totalBytes: 5 * 1024 * 1024 };
const TEXT_EXT = ['.html', '.js', '.css', '.json', '.md', '.txt'];
const MEDIA_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.ogg', '.wav'];
export const ALLOWED_EXT = TEXT_EXT.concat(MEDIA_EXT);
export const isText = path => TEXT_EXT.some(e => path.toLowerCase().endsWith(e));

// Things a game may not do. Games play in a locked box, so these are extra safety, and a teacher still reads the code.
const BANNED = [
  [/https?:\/\//i, 'a web address (http:// or https://). Games can’t load or link to other websites; put everything in your game folder.'],
  [/\b(?:src|href|action)\s*=\s*["']?\s*\/\//i, 'a link starting with //. Games can’t load things from other websites.'],
  [/\bfetch\s*\(/, 'fetch(). Games can’t talk to the internet.'],
  [/XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|sendBeacon/, 'a network connection. Games can’t talk to the internet.'],
  [/\bimport\s*\(|importScripts\s*\(|\bimport\s+[^;]*\bfrom\s+["']/, 'an import. Put all your code in your own files with <script src="...">.'],
  [/<\s*(?:form|iframe|object|embed|base|link)\b/i, 'a <form>, <iframe>, <object>, <embed>, <base> or <link> tag. Those aren’t allowed in community games (use <style> for CSS).'],
  [/<\s*meta[^>]*http-equiv/i, 'a <meta http-equiv> tag. Only <meta charset> and <meta name="viewport"> are allowed.'],
  [/window\.open\s*\(|\btop\s*\.\s*location|\bparent\s*\.\s*location|\blocation\s*(?:\.\s*href\s*)?=(?!=)|location\s*\.\s*(?:assign|replace)\s*\(/, 'code that opens or changes pages. Games stay on their own page.'],
  [/document\s*\.\s*cookie|localStorage|sessionStorage|indexedDB/, 'saved data (cookies or storage). Community games can’t save data; keep scores in variables while the game runs.'],
  [/\beval\s*\(|new\s+Function\s*\(|\bsetTimeout\s*\(\s*["'`]|\bsetInterval\s*\(\s*["'`]/, 'eval() or code inside a string. Write your code normally instead.'],
  [/\.\.\//, '"../". Games can only use files inside their own folder.'],
];
// Exact namespace strings JavaScript needs for drawing SVG are fine.
const ALLOWED_URLS = /http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink|1999\/xhtml|XML\/1998\/namespace)/g;

export function scanText(path, text) {
  const errors = [];
  const body = String(text).replace(ALLOWED_URLS, '');
  const lines = body.split(/\r?\n/);
  for (const [re, why] of BANNED) {
    const i = lines.findIndex(l => re.test(l));
    if (i >= 0) errors.push(`${path}, line ${i + 1}: uses ${why}`);
  }
  return errors;
}

export function validateGameJson(raw, id) {
  const errors = [];
  let g;
  try { g = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return { errors: [`game.json isn’t valid JSON: ${e.message}. Check for a missing comma or quote.`] }; }
  if (!g || typeof g !== 'object' || Array.isArray(g)) return { errors: ['game.json should be one { ... } object, like the starter’s.'] };
  const str = (k, min, max) => {
    const v = g[k];
    if (typeof v !== 'string' || v.trim().length < min) errors.push(`game.json: "${k}" is missing${min > 1 ? ` or shorter than ${min} characters` : ''}.`);
    else if (v.length > max) errors.push(`game.json: "${k}" is too long (${v.length} characters, the most is ${max}).`);
  };
  str('title', 1, 40);
  str('description', 10, 200);
  if (!GITHUB_USER.test(String(g.author || ''))) errors.push('game.json: "author" must be your GitHub username (letters, numbers and dashes).');
  if (!CATEGORIES.includes(g.category)) errors.push(`game.json: "category" must be one of: ${CATEGORIES.join(', ')}.`);
  if (!ICONS.includes(g.icon)) errors.push(`game.json: "icon" must be one of: ${ICONS.join(' ')}`);
  if (!COLORS.includes(g.color)) errors.push(`game.json: "color" must be one of: ${COLORS.join(', ')}.`);
  const extra = Object.keys(g).filter(k => !['title', 'description', 'author', 'category', 'icon', 'color'].includes(k));
  if (extra.length) errors.push(`game.json: remove the unknown field(s) ${extra.map(k => `"${k}"`).join(', ')}.`);
  if (!GAME_ID.test(id)) errors.push(`The folder name "${id}" must be 3 to 40 characters of lowercase letters, numbers and dashes, like "space-dodge".`);
  const game = errors.length ? null : { id, title: g.title.trim(), description: g.description.trim(), author: g.author, category: g.category, icon: g.icon, color: g.color };
  return { errors, game };
}

// files: [{ path: 'community/games/<id>/...', size, text? }] for one game folder
export function validateFolder(id, files) {
  const errors = [];
  const rel = f => f.path.slice((GAMES_DIR + id + '/').length);
  const names = files.map(rel);
  if (!names.includes('index.html')) errors.push('Your game folder needs an index.html file.');
  if (!names.includes('game.json')) errors.push('Your game folder needs a game.json file (copy it from the starter).');
  if (files.length > LIMITS.files) errors.push(`Too many files (${files.length}). The most is ${LIMITS.files}.`);
  let total = 0;
  for (const f of files) {
    const name = rel(f), lower = name.toLowerCase();
    total += f.size || 0;
    if (!ALLOWED_EXT.some(e => lower.endsWith(e))) errors.push(`${name}: this kind of file isn’t allowed. Use ${ALLOWED_EXT.join(' ')} files.`);
    if (lower.endsWith('.html') && name !== 'index.html') errors.push(`${name}: only one page is allowed, and it must be called index.html.`);
    if (/[^A-Za-z0-9._\/-]/.test(name)) errors.push(`${name}: file names can only use letters, numbers, dots, dashes, underscores and folders.`);
    if ((f.size || 0) > LIMITS.fileBytes) errors.push(`${name}: this file is too big (the most is 2 MB per file).`);
    if (isText(name) && name !== 'game.json' && typeof f.text === 'string') errors.push(...scanText(name, f.text));
  }
  if (total > LIMITS.totalBytes) errors.push(`Your game folder is too big (${(total / 1048576).toFixed(1)} MB). The most is 5 MB.`);
  return errors;
}

// Which game folder a student's pull request changes. Students may only change one game folder, their own.
export function foldersTouched(paths) {
  const outside = [], ids = new Set();
  for (const p of paths) {
    if (p.startsWith(GAMES_DIR)) { const id = p.slice(GAMES_DIR.length).split('/')[0]; if (id) ids.add(id); }
    else outside.push(p);
  }
  return { ids: [...ids], outside };
}

// Extra safety added when publishing: a game page can never talk to the internet, submit forms or embed other pages.
export const CSP = "connect-src 'none'; form-action 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'";
export function injectCsp(html) {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  const m = /<head[^>]*>/i.exec(html);
  return m ? html.slice(0, m.index + m[0].length) + tag + html.slice(m.index + m[0].length) : tag + html;
}
