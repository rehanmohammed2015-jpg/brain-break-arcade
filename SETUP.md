# Teacher setup: putting the arcade on GitHub

This takes about 30 minutes, once. After that, publishing a student's game is one click.

## 1. Get the tools

1. Make a GitHub account at [github.com](https://github.com) (or use your school's). Your username becomes part of the arcade's address, like `https://your-username.github.io/brain-break-arcade/`.
2. Install **GitHub Desktop** from [desktop.github.com](https://desktop.github.com) and sign in.

## 2. Put the arcade on GitHub

1. In GitHub Desktop: **File → Add local repository**, and choose this `brain-break-arcade-github` folder. When it asks, choose **create a repository** here.
2. Name it `brain-break-arcade` and press **Create repository**.
3. Open `.github/CODEOWNERS` in any text editor and replace `YOUR-GITHUB-USERNAME` with your GitHub username.
4. Optional: in `community/games/star-catcher/game.json`, change `"author"` to your username.
5. In GitHub Desktop, write a summary like "First version" and press **Commit to main**, then **Publish repository**. **Untick "Keep this code private"**, because GitHub Pages and student forks need a public repository.

## 3. Turn on the website

1. On github.com, open your repository → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab. If "Publish the arcade" hasn't run yet, click it, then **Run workflow**.
4. After about a minute, your arcade is live at `https://your-username.github.io/brain-break-arcade/`.

## 4. Make sure only you can publish games

1. **Settings → Branches → Add branch ruleset** (or **Add rule**), for the branch `main`:
   - ✅ **Require a pull request before merging**, with ✅ **Require review from Code Owners**.
   - ✅ **Require status checks to pass**, and add **check-games**. It appears in the list after the first pull request runs it.
   - ✅ **Block force pushes**.
2. **Settings → Actions → General → Fork pull request workflows from outside collaborators:** choose **Require approval for first-time contributors**. You'll press one button to let a new student's check run.
3. Don't add students as collaborators. They work in their own forks and send pull requests, so only you can merge.

## Reviewing a student's game

When a student sends a game, you'll get a GitHub notification for the pull request.

1. **Read the checker result** at the bottom of the pull request. ✅ means it follows the automatic rules. ❌ means the student has something to fix, and the checker told them what.
2. **Read the code** in the **Files changed** tab. The checker blocks the obvious dangers (internet access, outside links, saving data), but you're the real review. Look for personal information, unkind content, and anything that doesn't feel right for school.
3. **Play it before approving:**
   - In GitHub Desktop: **Current branch → Pull requests**, then pick the student's pull request.
   - **Repository → Show in Explorer**, open `community/games/<their-game>/`, and double-click `index.html`.
   - Switch back to `main` when you're done.
4. **Approve:** on github.com, press **Review changes → Approve**, then **Merge pull request**. The arcade updates itself within about a minute.
5. **Not ready?** Leave a kind comment saying what to change. The student updates their fork and the pull request updates by itself.

**To take a game down later:** delete its folder on github.com (open the folder → **⋯ → Delete directory**) and commit. The site updates itself.

## How it stays safe

- **Only you merge.** Students can't change the arcade directly; they can only ask.
- **Students can't touch other games:** the checker rejects any pull request that changes files outside one game folder, or a game that belongs to someone else.
- **Every game plays in a locked box** (a sandboxed frame). It can't read or change the arcade page, can't open pop-ups or other pages, and can't save data.
- **No internet:** when publishing, each game page gets a safety header that blocks it from talking to the internet.
- **What you approve is what runs.** Games live inside your repository, so nobody can swap a game after you approve it. Any change needs a new pull request.

## Good to know

- **Ages:** GitHub requires students to be 13 or older. For younger students, collect their game files and submit them yourself; the checker skips the author check for you as the owner.
- **Usernames:** student usernames are shown on their games. Encourage usernames that aren't real names.
- **Best scores:** saved best scores live in each browser, so the old claude.ai version's scores don't carry over.
- **Updating the built-in games:** change files in `games/`, then commit and push. The site rebuilds by itself.
- **`community/games.json`** is created automatically when the site is published. The copy in the repository is only for previewing on your own computer.
