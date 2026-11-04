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

## Release

Prepared 4 November 2026 from source commit `97eccf9fe61ec15a7bbc239599e15a4609ddca3b`.

## Official GitHub instructions

- Creating a Pages site https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Choosing a publishing source https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Uploading files https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
