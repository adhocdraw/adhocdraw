// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react";
import Logo from "./Logo";
import { REPO_URL } from "../links";

interface AboutDialogProps {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div
        className="shortcuts-panel about-panel"
        role="dialog"
        aria-label="About and privacy"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-header">
          <h2>About AdhocDraw &amp; privacy</h2>
          <button className="shortcuts-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="about-body">
          <Logo className="about-logo" height={40} />
          <p className="about-lead">
            <strong>Your diagrams stay on your device.</strong> AdhocDraw is built so that it does not send your
            diagrams, or anything about you, to any server. There are no accounts, cookies, analytics or tracking.
          </p>
          <ul>
            <li>
              Your work is saved in <em>your own browser</em> on this device: diagrams, their version history and
              added images, plus your preferences (theme, light or dark mode, tool settings).
            </li>
            <li>
              <strong>Save to file</strong> (or Ctrl/Cmd+S) writes a <code>.json</code> file to your computer, and{" "}
              <strong>Open from file</strong> loads it back. That file is your copy to keep. Save to a file
              regularly: clearing your browser data, or using a private window or another browser or device,
              removes the copy kept in your browser.
            </li>
            <li>
              <strong>On a phone or tablet,</strong> Save to file downloads a copy (look in your Downloads folder or the
              Files app), and each save makes a new file. Your browser may clear what it keeps for a site you have not
              visited for a while, so save to a file to be safe. Chrome and Safari on the same phone keep separate
              copies. Adding AdhocDraw to your Home Screen (in Safari: Share, then Add to Home Screen) gives it an app
              icon, and it still needs a connection to open.
            </li>
          </ul>
          <p>
            <strong>What we can't control:</strong> the site is hosted on GitHub, which may keep ordinary server
            logs. Browser extensions, shared computers and other software on your device can see what is on your
            screen and in your browser's storage. We can't speak for those.
          </p>
          <p>
            <strong>If we get it wrong:</strong> we check these promises before each release. If we find anything that
            doesn't match this notice, we will fix it and say so on our project page.
          </p>
          <p>
            <strong>Terms of use:</strong> AdhocDraw is free to use. You are responsible for what you create and for
            your own backups. It is provided "as is", without warranty of any kind, and its author is not liable for
            any loss or damage from using it (Apache License 2.0, sections 7 and 8).
          </p>
          <p>
            AdhocDraw is free, open-source software (Apache License 2.0). The name AdhocDraw and its logo are not
            covered by that licence. Website:{" "}
            <a href="https://www.adhocdraw.com" target="_blank" rel="noreferrer">
              www.adhocdraw.com
            </a>
            .
          </p>
          <p className="about-links">
            <a href="./PRIVACY.txt" target="_blank" rel="noreferrer">
              Privacy details
            </a>
            <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noreferrer">
              Report a problem
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href="./LICENSE.txt" target="_blank" rel="noreferrer">
              License
            </a>
            <a href="./NOTICE.txt" target="_blank" rel="noreferrer">
              Notice
            </a>
            <a href="./third-party-licenses.txt" target="_blank" rel="noreferrer">
              Open-source libraries &amp; licenses
            </a>
          </p>
          <p className="about-updated">Privacy notice last updated: 9 October 2026.</p>
          <p>
            The canvas is built with <a href="https://reactflow.dev" target="_blank" rel="noreferrer">React Flow</a>{" "}
            (MIT license), among other open-source libraries.
          </p>
        </div>
      </div>
    </div>
  );
}
