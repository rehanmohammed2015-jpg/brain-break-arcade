# Brain Break Arcade

Free browser games for middle schoolers, plus **Community Games** made by students.

- **Play:** open the arcade's GitHub Pages site.
- **Make a game:** read [CONTRIBUTING.md](CONTRIBUTING.md). You build it, send it in as a pull request, and your teacher approves it.
- **Run the arcade (teachers):** read [SETUP.md](SETUP.md).

## What's in here

| Path | What it is |
|---|---|
| `index.html`, `community.js` | The arcade website |
| `games/` | The 25 built-in games |
| `community/starter/` | The starter game students copy |
| `community/games/<game-id>/` | Student games, one folder each |
| `scripts/rules.mjs` | The rules every community game must follow |
| `scripts/check-games.mjs` | Checks each pull request against the rules |
| `scripts/build-site.mjs` | Builds the website for GitHub Pages |
| `.github/workflows/` | Runs the checker on pull requests and publishes the site |
