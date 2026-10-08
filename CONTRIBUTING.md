# Contributing to AdhocDraw

**Code contributions are not being accepted for now.** AdhocDraw's main promise is
that your diagrams and details never leave your device, and that promise is easiest
to keep while every change goes through one maintainer. This may change later.

What is welcome today:

- **Bug reports and ideas:** open an issue on the project's repository. Please do
  not paste private diagrams or personal data into an issue.
- **Forks:** the code is under the [Apache License 2.0](LICENSE), so you can copy
  and change it for yourself. Please give a modified version its own name; the name
  "AdhocDraw" is not licensed (see [NOTICE](NOTICE)).
- **Security or privacy concerns:** open an issue marked "privacy", without
  publishing exploit details.

## The privacy rules every change must follow

These are checked automatically (`npm run check:privacy` in `client/`, which also
runs as part of `npm run build` and on every pull request):

1. **No requests to other sites.** No `fetch`, `XMLHttpRequest`, WebSocket,
   EventSource, `sendBeacon`, service workers or remote imports. No external fonts,
   scripts, styles, images or analytics.
2. **No unreviewed libraries.** A new production dependency has to be added to
   `client/scripts/privacy-allowed-dependencies.json` on purpose, after checking its
   licence (MIT or Apache-2.0 only) and reading what it does.
3. **The Content-Security-Policy stays strict:** `default-src 'self'`, and
   `connect-src` only for the site's own files, data and blob URLs.
4. **No tracking or storage of user data on the website.** Diagrams and preferences
   stay in the visitor's own browser and files.

The Playwright tests in `e2e/` (see `privacy.spec.ts`, `local-storage.spec.ts` and
`privacy-guard.spec.ts`) also check this at run time (no requests to
other hosts, no CSP violations).

If code contributions are opened up later, this file will say so, and contributors
will be asked to sign off their commits (`Signed-off-by:`) so ownership stays clear.
