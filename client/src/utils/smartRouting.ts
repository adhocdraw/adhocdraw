// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Computes an obstacle-avoiding route between two already-positioned nodes,
// treating every node's current rect (source and target included - MSAGL
// routes an edge from its own node's boundary outward, not through it) as
// something later edges shouldn't cut through. Returns interior waypoints
// only, in the same flow-coordinate space as the input rects - the caller
// already knows the real source/target connection points (its own node
// handles) and prepends/appends those itself.
//
// Dynamically imported at the call site: @msagl/core is a large dependency only
// needed once the user actually asks for "Smart" routing.
export async function computeSmartRoute(
  sourceId: string,
  targetId: string,
  nodeRects: Map<string, Rect>
): Promise<{ x: number; y: number }[]> {
  const { CancelToken, CurveFactory, Edge, EdgeRoutingMode, GeomEdge, GeomGraph, GeomNode, Graph, Node, Point, SugiyamaLayoutSettings, routeEdges } =
    await import("@msagl/core");

  const graph = new Graph("smart-route");
  const msaglNodes = new Map<string, InstanceType<typeof Node>>();
  for (const id of nodeRects.keys()) {
    msaglNodes.set(id, graph.addNode(new Node(id)));
  }
  const source = msaglNodes.get(sourceId);
  const target = msaglNodes.get(targetId);
  if (!source || !target) return [];
  const edge = new Edge(source, target);

  const geomGraph = new GeomGraph(graph);
  for (const [id, rect] of nodeRects) {
    const geomNode = new GeomNode(msaglNodes.get(id)!);
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    geomNode.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(rect.width, rect.height, 4, 4, new Point(cx, cy));
  }
  const geomEdge = new GeomEdge(edge);

  // Used only as a carrier for `commonSettings.edgeRoutingSettings` here -
  // `routeEdges` routes edges around every other node's boundary without
  // touching node positions, regardless of which layout settings class
  // supplies those settings.
  const settings = new SugiyamaLayoutSettings();
  settings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline;
  geomGraph.layoutSettings = settings;

  routeEdges(geomGraph, [geomEdge], new CancelToken());

  const curve = geomEdge.curve;
  if (!curve) return [];
  const samples = 16;
  const points: { x: number; y: number }[] = [];
  for (let i = 1; i < samples; i++) {
    const t = curve.parStart + (curve.parEnd - curve.parStart) * (i / samples);
    const p = curve.value(t);
    points.push({ x: p.x, y: p.y });
  }
  return points;
}
