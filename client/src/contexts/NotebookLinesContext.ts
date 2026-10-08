// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { createContext } from "react";

// True while the canvas shows notebook ruled lines (White Board): text boxes
// then size themselves in whole ruled lines so they stay on the rules.
export const NotebookLinesContext = createContext(false);
