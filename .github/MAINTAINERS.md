# Maintainer checklist (GitHub settings)

These settings keep AdhocDraw's privacy promise safe from accidental or malicious
changes. They live in the repository's **Settings** on GitHub, not in the code.

## Account
- [ ] Two-factor authentication on for the owner account (use a security key or an
      authenticator app).
- [ ] Commit signing enabled (optional but recommended), so commits are verifiable.

## Branch protection for `main` (Settings > Branches > Add rule)
- [ ] Require a pull request before merging (no direct pushes to `main`).
- [ ] Require approvals: 1.
- [ ] Require review from Code Owners (see `.github/CODEOWNERS`).
- [ ] Require status checks to pass before merging: **Privacy check** (the
      workflow in `.github/workflows/privacy-check.yml`).
- [ ] Require branches to be up to date before merging.
- [ ] Do not allow force pushes; do not allow deletions.
- [ ] Include administrators (so the rules apply to you too).

## Publishing (GitHub Pages)
- [ ] Settings > Pages: Source = **GitHub Actions** (the workflow
      `.github/workflows/deploy-pages.yml` publishes the app).
- [ ] Custom domain `www.adhocdraw.com`, **Enforce HTTPS** on; DNS `CNAME` record
      `www` -> `adhocdraw.github.io`.
- [ ] Create the team `maintainers` in the `adhocdraw` organisation (the Code Owners
      in `.github/CODEOWNERS` point to `@adhocdraw/maintainers`) and add yourself.
- [ ] Settings > Environments > `github-pages`: restrict deployments to the `main`
      branch.

## Repository
- [ ] Settings > Actions > General: workflow permissions "Read repository
      contents" only, and require approval for workflows from outside contributors.
- [ ] Turn on Dependabot alerts and security updates (Settings > Code security).
- [ ] Turn on secret scanning and push protection.
- [ ] Keep the repository private until you decide to publish it; make it public
      only after reviewing the history for anything private.

## Before merging any change that touches dependencies or build files
- [ ] Read the diff of `client/package.json` and `client/package-lock.json`.
- [ ] For a new library: check its licence (MIT or Apache-2.0), read what it does,
      and add it to `client/scripts/privacy-allowed-dependencies.json` on purpose.
- [ ] Run the Playwright suite (`npx playwright test`).
