import { z } from 'zod';
import type { EvaluatedFrameJs, Project } from '@l2d/schema';

export const editorRequestSchemas = {
  state: z.object({ action: z.literal('state'), nodeOffset: z.int().min(0).default(0), nodeLimit: z.int().min(1).max(500).default(50) }).strict(),
  open_project: z.object({ action: z.literal('open_project'), path: z.string().min(1) }).strict(),
  select: z.object({ action: z.literal('select'), nodeIds: z.array(z.string()).max(500) }).strict(),
  set_parameters: z.object({ action: z.literal('set_parameters'), values: z.record(z.string(), z.number().finite()) }).strict(),
  viewport: z.object({ action: z.literal('viewport'), fit: z.boolean().optional(), zoom: z.number().min(0.01).max(20).optional(), pan: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(), flipped: z.boolean().optional(), solo: z.boolean().optional(), meshEdit: z.boolean().optional(), physics: z.boolean().optional(), autoIdle: z.boolean().optional(), gridSnap: z.boolean().optional() }).strict(),
  playback: z.object({ action: z.literal('playback'), animationId: z.string().optional(), playing: z.boolean().optional(), frame: z.number().finite().min(0).optional() }).strict(),
  expression: z.object({ action: z.literal('expression'), expressionId: z.string().nullable() }).strict(),
  show_panel: z.object({ action: z.literal('show_panel'), panel: z.enum(['hierarchy', 'viewport', 'parameters', 'inspector', 'timeline', 'physics', 'history']) }).strict(),
  exec: z.object({ action: z.literal('exec'), command: z.object({ id: z.string().min(1), name: z.string().min(1), params: z.record(z.string(), z.unknown()) }), dryRun: z.boolean().default(false) }).strict(),
  history: z.object({ action: z.literal('history'), operation: z.enum(['undo', 'redo', 'jump']), index: z.int().min(-1).optional() }).strict(),
  save: z.object({ action: z.literal('save'), path: z.string().min(1).optional() }).strict(),
  screenshot: z.object({ action: z.literal('screenshot'), target: z.enum(['window', 'model']).default('window'), scale: z.number().min(0.1).max(2).default(1) }).strict(),
};

export const editorRequestSchema = z.discriminatedUnion('action', [
  editorRequestSchemas.state, editorRequestSchemas.open_project, editorRequestSchemas.select,
  editorRequestSchemas.set_parameters, editorRequestSchemas.viewport, editorRequestSchemas.playback,
  editorRequestSchemas.expression,
  editorRequestSchemas.show_panel, editorRequestSchemas.exec, editorRequestSchemas.history,
  editorRequestSchemas.save, editorRequestSchemas.screenshot,
]);
export type EditorRequest = z.infer<typeof editorRequestSchema>;
export type RendererEditorRequest = Exclude<EditorRequest, { action: 'open_project' | 'screenshot' }>
  | { action: 'load_project'; path: string; project: Project }
  | { action: 'wait_for_preview' }
  | { action: 'capture_model'; scale: number };

export interface EditorViewportState {
  zoom: number;
  pan: { x: number; y: number };
  flipped: boolean;
  solo: boolean;
  texturesReady: boolean;
  frameRendered: boolean;
}
export interface EditorViewportControls {
  getState(): EditorViewportState;
  hasRenderedFrame(frame: EvaluatedFrameJs | null): boolean;
  update(request: Extract<EditorRequest, { action: 'viewport' }>): void;
  captureModel(scale: number): Promise<string>;
}
export interface EditorRequestMessage { id: string; request: RendererEditorRequest }
export interface EditorResponseMessage { id: string; result?: Record<string, unknown>; error?: string }
