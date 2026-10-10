# Maintainer checklist (GitHub settings)

These settings keep AdhocDraw's privacy promise safe from accidental or malicious
changes. They live in the repository's **Settings** on GitHub, not in the code.

## Account
- [ ] Two-factor authentication on for the owner account (use a security key or an
      authenticator app).
- [ ] Commit signing enabled (optional but recommended), so commits are verifiable.

## Branch protection for `main` (Settings > Branches or Rules > Rulesets)

With a single maintainer, do **not** require approvals or Code Owner review: you cannot
approve your own pull request, so that would lock you out of merging. Use:

- [ ] Require status checks to pass before merging: **Privacy check** (the workflow in
      `.github/workflows/privacy-check.yml`; it appears in the list after it has run once).
- [ ] Do not allow force pushes; do not allow deletions.
- [ ] Optional: require a pull request before merging, with **0** required approvals.
- [ ] Include administrators (so the rules apply to you too), once the above is set so
      you can still merge your own pull requests.

When a second maintainer joins, also turn on: required approvals = 1, and "Require
review from Code Owners" (see `.github/CODEOWNERS`).

## Publishing (GitHub Pages)
- [ ] Settings > Pages: Source = **GitHub Actions** (the workflow
      `.github/workflows/deploy-pages.yml` publishes the app).
- [ ] Custom domain `www.adhocdraw.com`, **Enforce HTTPS** on; DNS `CNAME` record
      `www` -> `adhocdraw.github.io`.
- [ ] Create the team `maintainers` in the `adhocdraw` organisation (github.com/orgs/adhocdraw/teams;
      the Code Owners in `.github/CODEOWNERS` point to `@adhocdraw/maintainers`), add
      yourself, and give the team Write access to the repository (Team > Repositories).
- [ ] Settings > Environments > `github-pages`: restrict deployments to the `main`
      branch.

## Repository
- [ ] Settings > Actions > General: workflow permissions "Read repository
      contents" only, and require approval for workflows from outside contributors.
- [ ] Turn on Dependabot alerts and security updates (Settings > Code security).
- [ ] Turn on secret scanning and push protection.
- [ ] Before every push to this public repository, run
      `node scripts/prepush-check.mjs <this clone> --build` (from the private project) and
      read its report; a push is visible immediately and cannot be fully undone.
- [ ] Turn on Private vulnerability reporting (Settings > Code security) as an extra route
      for `SECURITY.md`.
- [ ] After each deploy, check the Actions tab: "Deploy to GitHub Pages" and then
      "Post-deploy privacy check" should both be green.

## Before merging any change that touches dependencies or build files
- [ ] Read the diff of `client/package.json` and `client/package-lock.json`.
- [ ] For a new library: check its licence (MIT or Apache-2.0), read what it does,
      and add it to `client/scripts/privacy-allowed-dependencies.json` on purpose.
- [ ] Run the Playwright suite (`npx playwright test`).

## Releases
A release is a version marker (tag plus notes); deploying the site happens on every push
to `main` and does not need one. Versions follow Semantic Versioning, `vMAJOR.MINOR.PATCH`:
patch for fixes only (`v1.0.1`), minor for new features that keep saved files working
(`v1.1.0`), major for a change that breaks something (`v2.0.0`).

- [ ] When a batch of work is on `main`, the checks are green and the notes are ready, tag
      that commit and push the tag: `git tag v1.1.0 && git push origin v1.1.0`. Tag only
      after the tests pass: release immutability means a published tag cannot be moved.
- [ ] The workflow `.github/workflows/draft-release.yml` builds the app (with the privacy
      check) and creates a **draft** release with generated notes. It never publishes.
      Watch its first run in the Actions tab.
- [ ] Open the draft (Releases), replace or edit the generated notes (they come from commit
      messages; the local `pending/release_notes_*.md` drafts are usually better),
      check it is a normal release and marked **Latest**, then **Publish**. Published
      releases cannot be edited, so read it first.
- [ ] The workflow asks for `contents: write` for itself only; keep the repository default
      (Settings > Actions > General) at read-only.
