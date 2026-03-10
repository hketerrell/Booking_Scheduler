# GitHub Pages deployment guide (Vite + React)

This project now includes a GitHub Actions workflow at:

- `.github/workflows/deploy-gh-pages.yml`

## One-time setup in GitHub

1. Push this branch to GitHub.
2. Open **Repository Settings → Pages**.
3. In **Build and deployment**, set **Source** to **GitHub Actions**.
4. Ensure your default branch is `main` (the workflow deploys on pushes to `main`).

## How deployment works

- On each push to `main`, GitHub Actions will:
  - run `npm ci`
  - run `npm run build`
  - publish the built `dist/` folder to Pages
- You can also run it manually from **Actions → Deploy to GitHub Pages → Run workflow**.

## Important for Vite base path

The Vite config automatically sets the correct base path for project Pages during CI by using:

- `GITHUB_PAGES=true`
- `GITHUB_REPOSITORY` (provided by GitHub Actions)

So URLs become `/<repo-name>/...` on Pages, while local dev still works normally.

## Local build check

Run locally before pushing:

```bash
npm install
npm run build
npm run preview
```

Then open the preview URL shown in your terminal.
