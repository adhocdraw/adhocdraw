// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Refuse to run inside another page (clickjacking protection). GitHub Pages cannot
// send a frame-ancestors header, so the app checks for itself.
if (window.top !== window.self) {
  // Stop loading the rest of the page (so the app never starts), then show a message.
  window.stop();
  document.documentElement.innerHTML =
    '<head><title>AdhocDraw</title></head><body style="font:16px system-ui,sans-serif;padding:2rem">' +
    "AdhocDraw cannot be shown inside another page. " +
    'Open <a href="https://www.adhocdraw.com" target="_top" rel="noopener">www.adhocdraw.com</a> directly.</body>';
  throw new Error("AdhocDraw is not shown inside frames");
}
