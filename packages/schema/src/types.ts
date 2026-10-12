export const CURRENT_FORMAT_VERSION = 1;

export interface Canvas {
  width: number;
  height: number;
  origin_x: number;
  origin_y: number;
  background_color: string;
}

export interface Parameter {
  id: string;
  name: string;
  min: number;
  max: number;
  default: number;
}

export interface TextureMeta {
  id: string;
  path: string;
  width: number;
  height: number;
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'additive';

export interface WarpDeformerData {
  cols: number;
  rows: number;
  bounds: [number, number, number, number]; // min_x, min_y, width, height
  control_points: [number, number][];
}

export interface RotationDeformerData {
  origin: [number, number];
  angle_deg: number;
  scale: [number, number];
}

export interface ArtMeshData {
  texture_id: string;
  vertices: [number, number][];
  uvs: [number, number][];
  indices: number[];
  blend_mode: BlendMode;
  opacity: number;
  draw_order: number;
  mask_ids: string[];
}

export type NodeKind =
  | { type: 'Part'; collapsed?: boolean }
  | { type: 'WarpDeformer'; cols: number; rows: number; bounds: [number, number, number, number]; control_points: [number, number][] }
  | { type: 'RotationDeformer'; origin: [number, number]; angle_deg: number; scale: [number, number] }
  | ({ type: 'ArtMesh' } & ArtMeshData);

export interface Node {
  id: string;
  name: string;
  parent_id: string | null;
  visible: boolean;
  locked: boolean;
  kind: NodeKind;
}

export interface ParamDimension {
  param_id: string;
  keys: number[];
}

export type KeyformPayload =
  | { kind: 'Warp'; control_points: [number, number][] }
  | { kind: 'Rotation'; origin: [number, number]; angle_deg: number; scale: [number, number] }
  | { kind: 'ArtMesh'; vertex_offsets: [number, number][]; opacity?: number };

export interface KeyformState {
  coordinates: number[];
  payload: KeyformPayload;
}

export interface KeyformBinding {
  target_node_id: string;
  dimensions: ParamDimension[];
  keyforms: KeyformState[];
}

export interface Project {
  format_version: number;
  canvas: Canvas;
  parameters: Parameter[];
  nodes: Node[];
  keyforms: KeyformBinding[];
  textures: TextureMeta[];
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  target_id: string | null;
  json_path: string;
}

export interface EvaluatedMeshJs {
  id: string;
  texture_id: string;
  vertices: number[]; // flat [x, y, x, y...]
  uvs: number[];      // flat [u, v, u, v...]
  indices: number[];
  blend_mode: string;
  opacity: number;
  draw_order: number;
  mask_ids: string[];
}

export interface EvaluatedFrameJs {
  meshes: EvaluatedMeshJs[];
  total_vertices: number;
  total_indices: number;
}

export interface CompileReport {
  success: boolean;
  diagnostics: Diagnostic[];
  num_nodes: number;
  num_parameters: number;
}
