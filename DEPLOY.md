# Publishing Space Music with GitHub Pages

Build the app:

```bash
npm run build
```

The output is in the `dist/` folder. The GitHub Actions workflow builds this automatically on push; you only need to run it locally if you want to test the production build.

---

## Deploy to GitHub Pages

1. Push this project to a GitHub repo (e.g. `yourusername/spacemusic`).
2. In the repo go to **Settings > Pages**.
3. Under "Build and deployment", set **Source** to **GitHub Actions**.
4. Push a commit to the `main` branch (or run the "Deploy to GitHub Pages" workflow from the **Actions** tab).
5. After the workflow runs, the site is at `https://yourusername.github.io/spacemusic/`.

**First-time setup:** If you see "Configure GitHub Pages", click it and choose **GitHub Actions** as the source. The workflow in `.github/workflows/deploy-pages.yml` runs `npm run build` and deploys the `dist/` folder. Every push to `main` triggers a new deploy.

---

## Notes

- **Audio:** Browsers require a user gesture (e.g. "Start audio") before playing sound. The app is built for that.
- **HTTPS:** GitHub Pages serves over HTTPS, which is required for audio in modern browsers.
- **Custom domain:** You can add your own domain in the repo's Pages settings.
