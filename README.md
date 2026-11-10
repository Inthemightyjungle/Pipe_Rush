# Pipe Rush on GitHub Pages

This ready-to-upload game includes Normal, Rush, Endless and 35 Puzzle levels, 15 illustrated energy stories, the asset workshop and five background music tracks.

## Publish through the GitHub website

1. Sign in to GitHub and create a repository called `pipe-rush`. A public repository works with GitHub Free. Initialise it with a README so the upload controls are available.
2. Extract `Pipe_Rush_GitHub_Pages.zip` on your computer.
3. Open the repository. Choose **Add file → Upload files** and drag in the extracted contents. The repository root should contain `index.html`, `music/`, `.nojekyll` and this `README.md`. Commit to `main`.
4. If your file manager hides `.nojekyll`, use **Add file → Create new file**, name it `.nojekyll` and commit it.
5. Open **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, then select **main** and **/ (root)** and save.
6. After deployment finishes, return to **Settings → Pages** and click **Visit site**. GitHub supplies the actual game URL here. Publishing can take up to 10 minutes.

Upload the extracted files directly into the repository root. Keep `music/` alongside `index.html` so the soundtrack loads under the project URL. Uploading the ZIP as one file creates a downloadable archive rather than a playable site.

## Playing and updates

The game runs in the browser. No server, API key, package installation or build step is required for this release. The five recordings are assigned to Opening, Normal, Rush, Endless and Puzzle by their supplied names. Music and volume controls are under Options. Some browsers need a click or tap before starting audio.

The GitHub Pages address is publicly accessible. Saved progress is stored locally by browser and site address, so the new GitHub address begins with separate progress from the previous host.

For future releases, replace `index.html` and the contents of `music/` together, then commit to `main`. This package contains the playable release. The continuing editable project remains in the development repository.

## Play statistics

The game can send anonymous play statistics to a Google Sheet owned by the developer. It records a random ID for each device, the device type, browser, screen size, language and time zone, how long the game was open and played, and which levels were started, won, failed or quit, with stars, scores and quiz answers. No names, accounts, email addresses or locations are collected. A player who clears their browser data appears as a new player.

Statistics are sent only from the public website. They are off on claude.ai, on `localhost` and when the file is opened from disk, and they stay off until a sheet address is set.

### Switching it on

1. Make a new Google Sheet. Open **Extensions → Apps Script**, replace the code with `stats/PipeRush-stats.gs` and save.
2. Choose the function `setup`, press **Run** and approve the permission prompt. The sheet gains its tabs.
3. Choose **Deploy → New deployment → Web app**. Set **Execute as** to **Me** and **Who has access** to **Anyone**, then deploy.
4. Copy the web app URL, which ends in `/exec`, and run `python3 stats/inject.py --url <that URL>`. Commit `index.html` and `stats/pipe-rush-stats.js` to `main`.

To check the address, open it in a browser: it answers `Pipe Rush stats are live.`

### The sheet

- **Summary:** the headline numbers.
- **Players:** one row per device, with play time in total and per mode, sessions, days active, progress and device details.
- **Sessions:** one row per visit.
- **Levels:** one row each time a level ends.
- **Level stats:** starts, wins, failures and average time for each level in each mode.
- **Daily:** one row per day.
- **Quiz:** how often each question is answered correctly.
- **Events:** the raw log.

Play time counts only inside a level with the board showing. It stops on cards, the pause menu and quizzes, in a background tab, and after a minute without input. **File → Download → Microsoft Excel** saves the sheet as an `.xlsx` file.

### After a new build

A fresh `index.html` from the development repository does not contain the statistics block. Run `python3 stats/inject.py` after replacing `index.html`; the saved address is kept. The block hooks these functions in the game's main script: `startDay`, `newGame`, `show`, `win`, `blackout`, `finishHardRound`, `recordRushRound`, `rotateAt`, `putPipe`, `sendGas`, `quizResult`, `startPuzzle`, `answerPuzzleQuiz` and `moveRoute`. If a build renames one of them, update `stats/pipe-rush-stats.js`.

Tests: `node stats/test/unit.js stats/PipeRush-stats.gs` checks the sheet script against an in-memory sheet. `node stats/test/e2e.js "$PWD"` plays the game in headless Chromium (Playwright) and checks what reaches the sheet.

## Release

Prepared 4 November 2026 from source commit `97eccf9fe61ec15a7bbc239599e15a4609ddca3b`.

## Official GitHub instructions

- Creating a Pages site https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Choosing a publishing source https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Uploading files https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
