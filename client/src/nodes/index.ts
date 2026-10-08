// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import StickyNoteNode from "./StickyNoteNode";
import TextNode from "./TextNode";
import ShapeNode from "./ShapeNode";
import FrameNode from "./FrameNode";
import ImageNode from "./ImageNode";
import FreehandNode from "./FreehandNode";
import GroupNode from "./GroupNode";
import SwimlaneNode from "./SwimlaneNode";
import TableNode from "./TableNode";
import UMLClassNode from "./UMLClassNode";

export const nodeTypes = {
  sticky: StickyNoteNode,
  text: TextNode,
  shape: ShapeNode,
  frame: FrameNode,
  image: ImageNode,
  freehand: FreehandNode,
  group: GroupNode,
  swimlane: SwimlaneNode,
  table: TableNode,
  "uml-class": UMLClassNode,
};
