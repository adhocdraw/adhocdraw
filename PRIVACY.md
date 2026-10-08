# Privacy

This is the privacy notice for the hosted version of AdhocDraw (www.adhocdraw.com), a
static site: the app has no server of its own. A short version is shown in the app
under **About**.

**Short version: AdhocDraw is built so that your diagrams stay on your device and the
app itself collects nothing about you. Some things are outside the app's control; they
are listed below.**

## What the app does with your data

- **Your diagrams stay on your device.** Your diagrams, their version history and the
  images you add are saved in your own browser's storage (IndexedDB) on this device.
  They stay there until you close the diagram or clear this site's data. The app has no
  code that sends them to any server or to anyone else.
- **Your files are yours.** "Save to File" (or Ctrl/Cmd+S) writes a `.json` file to your
  own computer, and "Open from file" reads one back. That file is the durable copy of
  your work.
- **Preferences stay on your device.** The theme (Classic or Palette) and light/dark
  mode you last used, your pencil settings, panel positions and which diagram you had
  open last are saved in your browser's localStorage so the app looks the way you left
  it.
- **No accounts, no cookies, no analytics, no tracking, no ads.** The app does not
  load fonts, scripts, images or anything else from other websites. It makes no
  requests except for its own files, and a Content-Security-Policy tells your browser
  to refuse any connection to another site.

## What the app cannot control

- **The host.** The site is served by GitHub Pages. GitHub may keep standard server logs
  (for example the IP address, time and browser type of each request for the app's
  files) and controls its own servers and infrastructure. The app itself does not
  collect or read these and has no access to your diagrams.
- **Your browser and device.** Clearing site data, using a private window, or switching
  browsers or devices means the saved copy in your browser is gone. **Save to File**
  regularly to keep your work. Anyone who can use your browser profile can see what the
  app keeps in it, and browser extensions that have access to the page can read what is
  on screen and in the browser's storage. Some browser features (for example
  translation, enhanced spell-checking or sync) can send text to the browser's vendor,
  and cloud-synced folders you save files into are copied by their provider. A website
  cannot block these. Only install extensions you trust, and clear the site's data on a
  shared computer.
- **Software we depend on.** AdhocDraw is built from open-source libraries that we
  review and check before each release. Like any software, a flaw or a change we missed
  is possible.

## If something is wrong

We aim to keep every statement here true, and we check them automatically before each
release. If we find that the app does not match this notice, we will fix it promptly
and publish a short note in the project's repository saying what happened, what it
affected and what we changed.

To report a problem, open an issue labelled "privacy" (see [SECURITY.md](SECURITY.md)).
Please do not paste private diagrams or exploit details into an issue.

## For technical readers: how to verify this

- Open your browser's developer tools and use the app. The Network tab should list only
  requests for this site's own files, and the Application (or Storage) tab should show no
  cookies for the site. The app's own data appears there as IndexedDB and localStorage
  entries.
- The Content-Security-Policy is set in the page itself (GitHub Pages cannot send custom
  headers): `default-src 'self'`, with connections allowed only to the site's own files,
  data and blob URLs. A small script (`frame-guard.js`) stops the app running inside
  another page.
- An automatic check (`npm run check:privacy`, part of every build and every pull
  request) fails a release if the code or its libraries could contact another site or
  if an unreviewed library is added. Playwright tests also check that no request leaves
  the site and that no policy violation occurs.
- The source code is public: https://github.com/adhocdraw/adhocdraw

## Your content, no warranty

You are responsible for the content you create and for keeping your own backups.
The app is provided "as is", without warranty of any kind, and its author is not
liable for loss or damage from using it; see the [LICENSE](LICENSE) (Apache
License 2.0) and [NOTICE](NOTICE). The libraries it is built from are listed, with their
licenses, in `client/THIRD_PARTY_LICENSES.txt` (shipped as
`third-party-licenses.txt` with the hosted app).

## Changes to this notice

If this notice changes, the new version is published here and the history is in the
repository.

Last updated: 7 October 2026.
