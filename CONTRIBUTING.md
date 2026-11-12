# Publish your game in the Brain Break Arcade 🎮

Anyone can make a game for the arcade. You build it, send it in, and your teacher checks it. Once it's approved, it shows up in the **Community Games** section for everyone to play.

You don't need to install anything. Everything below works on the GitHub website.

---

## Before you start

- You need a free **GitHub** account from [github.com](https://github.com). GitHub's rules say you must be **13 or older**. If you're younger, build your game anyway and ask your teacher to send it in for you.
- Pick a username that **isn't your real name**, like `pixel-falcon-42`. Your username is shown on your game.

## Step 1: Make your own copy of the arcade

1. Open the arcade's page on GitHub.
2. Press **Fork** (top right), then **Create fork**. You now have your own copy to work in.

## Step 2: Start from the starter game

1. In your fork, open the folder **community → starter**. It has three files:
   - `index.html` is the page your game runs on.
   - `game.js` is the game itself: Star Catcher, a simple game you can change.
   - `game.json` is your game's name card.
2. Make a new folder for your game: open **community → games**, press **Add file → Create new file**, and type a name like `space-dodge/game.json`. Typing the `/` makes the folder.
   - Folder names use **lowercase letters, numbers and dashes** only, 3 to 40 characters.
3. Copy the contents of the starter's three files into your folder (same file names).

## Step 3: Fill in game.json

```json
{
  "title": "Space Dodge",
  "description": "Steer your ship between the asteroids. Press the arrow keys to move.",
  "author": "pixel-falcon-42",
  "category": "arcade",
  "icon": "🚀",
  "color": "pop"
}
```

| Field | What to put |
|---|---|
| `title` | Your game's name, up to 40 characters |
| `description` | How to play, 10 to 200 characters |
| `author` | **Your GitHub username**, exactly |
| `category` | `arcade`, `sports`, `strategy` or `brain` |
| `icon` | One of: 🚀 ⚽ 🏀 🧩 🐉 👾 🏎️ 🎯 🌋 🐸 🛸 🏰 🎸 🧠 ⭐ 🍕 |
| `color` | One of: `dash` (pink), `pop` (blue), `math` (periwinkle), `memory` (teal), `words` (orange), `stack` (purple), `gold`, `p1` (red) |

## Step 4: Build your game

Change `game.js` (and `index.html` if you want) to make your own game. Some ideas:

- Change the colors, the speed, or what falls from the sky.
- Add a timer, levels, a high score, or sound effects (put `.mp3` or `.wav` files in your folder).
- Draw your own pictures as `.png` files and use them in your game.

**Testing it:** download your folder (or copy the files to your computer) and double-click `index.html` to play it in your browser.

### What your game can use

- Files inside **your own folder**: `index.html`, `.js`, `.css`, `.json`, `.png`, `.jpg`, `.gif`, `.webp`, `.mp3`, `.ogg`, `.wav`, `.md`, `.txt`.
- Up to 40 files, 2 MB per file, and 5 MB in total.

### What your game can't use

The robot checker will tell you if it finds any of these:

- ❌ Web addresses (`http://...` or `https://...`) or anything loaded from another website. Put all your files in your folder instead.
- ❌ Talking to the internet: `fetch`, `XMLHttpRequest`, `WebSocket`.
- ❌ Saving data: `localStorage`, cookies. Community games run in a safe box that can't save. Keep scores in variables while the game is running.
- ❌ Opening or changing pages: `window.open`, `location = ...`.
- ❌ `<form>`, `<iframe>`, `<link>` and `<object>` tags, `eval()`, and `../` paths.

## Step 5: Send it in

1. In your fork, press **Contribute → Open pull request**.
2. Give it a title like **"New game: Space Dodge"**, and tick every box in the creator rules checklist.
3. Press **Create pull request**.

## Step 6: Wait for the checks

- **The robot checker** runs within a couple of minutes. The first time you send a game, it may wait until your teacher lets it run.
  - ✅ means your game follows the rules.
  - ❌ means something needs fixing. Click **Details** to read what. Fix it in your fork and commit again; the check runs again by itself.
- **Your teacher** then plays your game and reads your code. They might ask for changes in a comment.
- **When they approve and merge it,** your game goes live in the arcade within about a minute. 🎉

## Creator rules

1. You made the game yourself, or you have permission for everything in it.
2. No real names, photos, addresses, schools or other personal info.
3. Nothing scary, violent or mean that wouldn't be OK at school.
4. No chat, no ads, no links to other websites, and no asking players for information.
5. Only change files inside your own game folder. You can always send updates to your own game later.

Have fun, and make something you'd want to play! 🚀
