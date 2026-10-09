<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="client/public/logo-dark.svg">
    <img src="client/public/logo.svg" alt="AdhocDraw" height="40">
  </picture>
</h1>

Website: [www.adhocdraw.com](https://www.adhocdraw.com)

AdhocDraw is a free tool for quick diagrams, white boards and notebooks that keeps
your work on your device. It runs in your browser and is built so that your diagrams
stay on your device: they are stored in your browser and in files you save yourself, and
the app contains no code that sends them to a server. There are no accounts, cookies,
analytics or tracking. The site is hosted on GitHub Pages, which may keep standard
server logs; see [PRIVACY.md](PRIVACY.md) for what the app cannot control, and
[SECURITY.md](SECURITY.md) to report a problem. Diagrams are kept in the browser's own
storage while you work, and you save them to a file on your computer when you want a
durable copy.

## Stack

- **App**: React + TypeScript + Vite, [@xyflow/react](https://reactflow.dev/) (React Flow) for the canvas
- **Storage**: the browser's IndexedDB and localStorage; files via the File System Access API (with a download fallback)
- **Tests**: Playwright

All libraries used are free and open source (MIT or Apache-2.0).

## Develop

```
cd client
npm install
npm run dev        # http://localhost:5173
```

Build and run the production build (what gets published):

```
cd client
npm run build      # outputs client/dist, then runs the privacy check
npm run preview    # http://localhost:4173
```

## Test

End-to-end tests (Playwright) cover the app: diagrams, templates, all widget types,
connections, autosave and persistence, undo/redo, the style panel, frames,
multi-select, pages, pencil, text, themes, export, and the privacy guarantees
(no requests to other sites, a strict Content-Security-Policy).

```
npm install                    # in the repository root
npx playwright install chromium
npx playwright test            # builds the app and serves it on :4173
```

Each test starts with an empty browser, so tests never share data.

## Usage

**Creating diagrams**
- **New** (toolbar) offers *Blank Chart*, *White Board* (pencil on, notebook
  ruled lines) and *Notebook* (starts as a copy of the White Board; notebook-only
  features are planned). A new diagram is named after the option you used:
  Chart 1, White Board 1, Notebook 1, ...
- Diagram tabs run along the top; double-click a tab name, or press **F2**, to
  rename the open diagram. The **AdhocDraw** logo at the top left links to the
  website. Each diagram can have several **pages**, in the pages bar at the
  bottom-left of the canvas (previous/next, rename, reorder, add). Drag its grip
  to move it.

**Editing**
- **Shapes** opens the Shapes & Widgets dock (double-click, or on a touch screen tap, a shape to add it):
  sticky notes, text, frames, swimlanes, tables, UML classes, many shapes and
  custom SVG/PNG shapes. Drag from a node's edge handle to another node to draw
  a connector. Double-click a node to edit its text; select it to restyle,
  resize or delete (Backspace/Delete).
- On a White Board or Notebook, a floating **tool panel** has Undo and Redo, then
  Shapes, Hand (pan), Select, Pencil, Text, Snap to grid, and Focus (full-screen
  editing, `F`) and Present. In focus mode the diagram name shows at the bottom left.
- **Pencil** draws freehand (colour, thickness, opacity and line style in its
  panel; hold Space or push to the canvas edge to scroll). **Select** drags a
  selection box. **Snap to grid** (on by default) is in the Draw group.
- **History** (version history), **Find** (find and replace) and **Present**
  (full-screen slideshow of the pages) are in the View group; press `?` for all
  keyboard shortcuts.
- Export as PNG, SVG or PDF from the **Export** menu.

**Saving**
- Changes autosave in the browser about 600ms after you stop editing; the save status at the right end
  of the tab pane shows *Saved in browser / not saved to a file* until you use
  **Save to file** (Ctrl/Cmd+S), which writes a `.json` to your computer.
  **Open from file** loads one back.
- **On a phone or tablet** (and in Firefox or desktop Safari) the browser has no file-save
  dialog, so **Save to file** downloads a `.json` copy (Downloads folder or the Files
  app) and each save makes a new file instead of overwriting the last. Only desktop
  Chrome and Edge can save back to the same file. **Open from file** uses the device's
  file picker, so save the file where you can find it again (Files, iCloud, Downloads).
  Diagrams are kept per browser: Chrome and Safari on one phone do not share them, and
  a mobile browser may clear a site's stored data after a while without a visit (about a
  week on iPhone) or in a private tab, so save to a file for anything you want to keep.
  Edits are written to the browser as soon as the page is hidden.

**Look**
- Two themes, **Classic** and **Palette** (an artist's-palette look), each in
  light and dark mode. The theme and mode buttons are icon-only, at the top right
  of the toolbar; the last choice is remembered in the browser.

## Contributing

Code contributions are not being accepted for now, to keep the privacy promise easy
to guard; bug reports and ideas are welcome as issues. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the privacy rules every change follows
(checked automatically by `npm run check:privacy`, part of `npm run build`).

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE)
for the copyright notice. The libraries the app is built from keep their own
licenses, listed in `client/THIRD_PARTY_LICENSES.txt`.

## Trademark

The name "AdhocDraw" and any AdhocDraw logo are not covered by the Apache License
(section 6 of the license grants no right to use them). You are welcome to fork
and modify the code under the license, but please give a modified version its own
name and do not present it as the official AdhocDraw.

The logo and icon files (`client/public/logo.svg`, `client/public/logo-dark.svg` and
`client/public/favicon.svg`)
are not part of the Apache-licensed code. All rights are reserved; please do not
copy or reuse them. Forks should remove them and use their own name and logo.
