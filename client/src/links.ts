// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

// Where the project's source code lives. Opened in a new tab when the user clicks
// the GitHub button; the app itself never contacts it.
export const REPO_URL = "https://github.com/adhocdraw/adhocdraw";

export const openRepo = () => {
  window.open(REPO_URL, "_blank", "noopener,noreferrer");
};

// The product website. The brand in the toolbar links here (new tab).
export const SITE_URL = "https://www.adhocdraw.com";
