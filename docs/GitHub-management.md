# GitHub source management

The working folder remains `/Volumes/ORICO/UNFOLD`. Git tracks source, configuration, tests and text documentation.

## Run locally

```sh
python3 tools/serve.py
# http://127.0.0.1:8771/
# http://127.0.0.1:8771/sequence.html
node --test tools/test/*.test.mjs
node tools/verify_daily.mjs        # everything for the daily samples (needs Chromium through Playwright, ffmpeg and python3); see docs/daily-samples-routine.md
```

The app uses static HTML/CSS/JavaScript and bundled Three.js.

## Files kept on ORICO

Music, lyric source material, images, 3D models, videos, .unfold projects, ZIP releases and archive backups are excluded. Keep a separate backup of those files on another device.

Guide thumbnails and preview videos (the old method gallery's `app/guide/methods/`), verification screenshots and videos are also excluded. A fresh clone therefore has missing guide previews; use the complete ORICO folder for deployment. The one exception is `app/guide/samples/*.jpg|mp4`, the small previews of the samples page: they are in Git (made by `tools/make_sample_previews.mjs`, each under 80 KB / 400 KB, checked by `tools/verify_daily.mjs`). The browser lyric integration test additionally needs the local synthetic audio fixture `tools/test/fixtures/lyric-fixture.mp3`. Node tests run from source alone; historical comparisons skip when the archived baseline is absent.

The ignore file allows only selected source and documentation extensions. Update it when adding a new source format. Never put credentials in tracked code or documentation. The repository is meant to be public, so do not name people either: no nickname of the author or of the AI, no Mac user folder (`/Users/<name>/…`; write `~/…` or a path relative to the repository) and no personal mail address. `tools/test/public-hygiene.test.mjs` checks this.

## Save a change

```sh
git status --short
git diff
git add app tools scripts docs README.md .gitignore
git diff --cached --stat
git commit -m "Describe the change"
git push
```

Pushing to GitHub does not deploy the public site. No deployment automation was added by this setup.
