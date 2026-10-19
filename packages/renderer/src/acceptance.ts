import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { evaluateAnimationAtFrameJs, type EvaluatedFrameJs, type Project } from '@l2d/schema';
import { WasmModel, lintProjectJson } from '@l2d/schema/wasm-node';
import {
  createRenderSessionCache,
  disposeRenderSessionCache,
  renderFrameToCanvas,
} from './headless.js';

export interface AcceptanceCase {
  id: string;
  parameters?: Record<string, number>;
  expressionId?: string;
  animationId?: string;
  frame?: number;
}

export interface AcceptancePlan {
  cases?: AcceptanceCase[];
  comparisons?: {
    reference: string;
    actual: string;
    region: [number, number, number, number];
    tolerance?: number;
    maxChangedPixels?: number;
  }[];
}

const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

async function readAcceptanceInputs(projectPath: string) {
  const raw = await fs.readFile(projectPath, 'utf8');
  const project: Project = JSON.parse(raw);
  const resources = await Promise.all(project.textures.map(async texture => {
    const bytes = await fs.readFile(path.resolve(path.dirname(projectPath), texture.path));
    return { id: texture.id, path: texture.path, sha256: digest(bytes), bytes };
  }));
  const require = createRequire(import.meta.url);
  const wasmEntry = require.resolve('@l2d/schema/wasm-node');
  const schemaEntry = require.resolve('@l2d/schema');
  const commandEntry = require.resolve('@l2d/command');
  const canvasEntry = require.resolve('@napi-rs/canvas');
  const buildFiles = [wasmEntry, wasmEntry.replace(/\.js$/, '_bg.wasm'), fileURLToPath(import.meta.url), fileURLToPath(new URL('./headless.js', import.meta.url)), schemaEntry, path.join(path.dirname(schemaEntry), 'evaluator.js'), path.join(path.dirname(schemaEntry), 'mesh-topology.js'), commandEntry, canvasEntry];
  const buildHashes = await Promise.all(buildFiles.map(async file => digest(await fs.readFile(file))));
  const revision = {
    projectSha256: digest(raw),
    textures: resources.map(({ id, path, sha256 }) => ({ id, path, sha256 })),
    buildSha256: digest(JSON.stringify(buildHashes)),
    commandSha256: digest(await fs.readFile(path.join(path.dirname(commandEntry), 'index.js'))),
    canvasVersion: String(require('@napi-rs/canvas/package.json').version),
  };
  return { raw, project, resources, revision: { ...revision, sha256: digest(JSON.stringify(revision)) } };
}

/** Bounded sweeps include intermediate values and combinations, not just endpoints. */
function defaultCases(project: Project): AcceptanceCase[] {
  const cases: AcceptanceCase[] = [{ id: 'neutral' }];
  const byId = new Map(project.parameters.map(parameter => [parameter.id, parameter]));
  for (const parameter of project.parameters) {
    for (let i = 0; i <= 4; i++) cases.push({ id: `parameter-${cases.length}`, parameters: { [parameter.id]: parameter.min + (parameter.max - parameter.min) * i / 4 } });
  }
  for (const expression of project.expressions ?? []) {
    cases.push({ id: `expression-${cases.length}`, expressionId: expression.id });
  }
  const yaw = byId.get('ParamAngleX');
  const mouth = byId.get('ParamMouthOpenY');
  const gazeX = byId.get('ParamEyeBallX'), gazeY = byId.get('ParamEyeBallY');
  if (yaw && mouth) {
    for (const angle of [yaw.min, yaw.default, yaw.max]) {
      for (const open of [mouth.min, (mouth.min + mouth.max) / 2, mouth.max]) {
        for (const fraction of [0, 0.5, 1]) {
          const parameters: Record<string, number> = { [yaw.id]: angle, [mouth.id]: open };
          for (const eyeId of ['ParamEyeLOpen', 'ParamEyeROpen']) {
            const eye = byId.get(eyeId);
            if (eye) parameters[eyeId] = eye.min + (eye.max - eye.min) * fraction;
          }
          if (gazeX && gazeY) {
            for (const x of [gazeX.min, gazeX.max]) for (const y of [gazeY.min, gazeY.max]) {
              cases.push({ id: `face-combination-${cases.length}`, parameters: { ...parameters, [gazeX.id]: x, [gazeY.id]: y } });
            }
          } else cases.push({ id: `face-combination-${cases.length}`, parameters });
        }
      }
    }
  }
  if (yaw) for (const expression of project.expressions ?? []) {
    for (const angle of [yaw.min, yaw.max]) {
      cases.push({ id: `expression-pose-${cases.length}`, expressionId: expression.id, parameters: { [yaw.id]: angle, ...(mouth ? { [mouth.id]: (mouth.min + mouth.max) / 2 } : {}) } });
    }
  }
  for (const animation of project.animations ?? []) {
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      cases.push({ id: `animation-${cases.length}`, animationId: animation.id, frame: Math.max(0, animation.duration_frames - 1) * fraction });
    }
  }
  return cases;
}

function triangleAreas(frame: EvaluatedFrameJs): Map<string, number[]> {
  return new Map(frame.meshes.map(mesh => [mesh.id, Array.from({ length: mesh.indices.length / 3 }, (_, triangle) => {
    const [a, b, c] = mesh.indices.slice(triangle * 3, triangle * 3 + 3).map(index => index * 2);
    return (mesh.vertices[b] - mesh.vertices[a]) * (mesh.vertices[c + 1] - mesh.vertices[a + 1]) - (mesh.vertices[b + 1] - mesh.vertices[a + 1]) * (mesh.vertices[c] - mesh.vertices[a]);
  })]));
}

export async function runAcceptance(projectPath: string, outputDirectory: string, plan: AcceptancePlan = {}) {
  const input = await readAcceptanceInputs(projectPath);
  const { project, raw, revision } = input;
  const cases = plan.cases ?? defaultCases(project);
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 1000) throw new Error('Acceptance requires 1..1000 cases; use an explicit plan for larger projects');
  const ids = new Set<string>();
  for (const entry of cases) {
    if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(entry.id) || entry.id === 'contact' || ids.has(entry.id)) throw new Error('Case IDs must be unique simple filenames (contact is reserved)');
    ids.add(entry.id);
    if (entry.expressionId && !project.expressions?.some(expression => expression.id === entry.expressionId)) throw new Error(`Unknown expression '${entry.expressionId}'`);
    const animation = entry.animationId ? project.animations?.find(animation => animation.id === entry.animationId) : undefined;
    if (entry.animationId && !animation) throw new Error(`Unknown animation '${entry.animationId}'`);
    if (entry.frame !== undefined && (!animation || !Number.isFinite(entry.frame) || entry.frame < 0 || entry.frame > animation.duration_frames)) throw new Error('Animation frame outside range');
    for (const [id, value] of Object.entries(entry.parameters ?? {})) {
      if (!project.parameters.some(parameter => parameter.id === id) || !Number.isFinite(value)) throw new Error(`Invalid parameter '${id}'`);
    }
  }
  for (const comparison of plan.comparisons ?? []) {
    const [x, y, width, height] = comparison.region;
    if (!ids.has(comparison.reference) || !ids.has(comparison.actual) || comparison.region.length !== 4 || !comparison.region.every(Number.isInteger) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > project.canvas.width || y + height > project.canvas.height || !Number.isFinite(comparison.tolerance ?? 2) || (comparison.tolerance ?? 2) < 0 || !Number.isInteger(comparison.maxChangedPixels ?? 0) || (comparison.maxChangedPixels ?? 0) < 0) throw new Error('Invalid pixel comparison');
  }
  // A new run gets its own directory, preventing stale frames or reports being mixed in.
  await fs.mkdir(path.dirname(path.resolve(outputDirectory)), { recursive: true });
  await fs.mkdir(outputDirectory, { recursive: false });
  const textures = new Map(input.resources.map(resource => [resource.id, resource.bytes]));
  const model = new WasmModel(raw);
  const renderCache = createRenderSessionCache();
  const defaults = Object.fromEntries(project.parameters.map(parameter => [parameter.id, parameter.default]));
  const expressionDefaults = Object.fromEntries((project.expressions ?? []).map(expression => [`__expression_weight:${expression.id}`, 0]));
  const results: { id: string; input: AcceptanceCase; parameters: Record<string, number>; issues: string[]; image: string; sha256: string }[] = [];
  const images = new Map<string, Buffer>();
  const renderedImages = new Map<string, Buffer>();
  try {
    for (const [id, value] of Object.entries(defaults)) model.setParameter(id, value);
    const reference = triangleAreas(model.evaluate() as EvaluatedFrameJs);
    for (const entry of cases) {
      const animation = project.animations?.find(animation => animation.id === entry.animationId);
      const parameters = { ...defaults, ...(animation ? evaluateAnimationAtFrameJs(animation, entry.frame ?? 0) : {}), ...entry.parameters };
      const issues: string[] = [];
      for (const [id, value] of Object.entries(parameters)) {
        const parameter = project.parameters.find(parameter => parameter.id === id);
        if (!parameter || !Number.isFinite(value) || value < parameter.min || value > parameter.max) issues.push(`Parameter out of range: ${id}=${value}`);
      }
      for (const [id, value] of Object.entries({ ...parameters, ...expressionDefaults, ...(entry.expressionId ? { [`__expression_weight:${entry.expressionId}`]: 1 } : {}) })) model.setParameter(id, value);
      const frame = model.evaluate() as EvaluatedFrameJs;
      const areas = triangleAreas(frame);
      for (const mesh of frame.meshes) {
        if (mesh.vertices.some(value => !Number.isFinite(value))) issues.push(`Non-finite vertices: ${mesh.id}`);
        if (mesh.opacity <= 0.001) continue;
        const current = areas.get(mesh.id)!;
        const original = reference.get(mesh.id);
        current.forEach((area, triangle) => {
          if (!Number.isFinite(area) || (original && Math.abs(original[triangle]) > 1e-8 && area * original[triangle] < 0)) issues.push(`Inverted triangle: ${mesh.id}:${triangle}`);
        });
      }
      const png = await renderFrameToCanvas(
        project.canvas.width,
        project.canvas.height,
        frame,
        id => textures.get(id) ?? null,
        project.canvas.background_color,
        renderCache
      );
      const filename = `${entry.id}.png`;
      await fs.writeFile(path.join(outputDirectory, filename), png, { flag: 'wx' });
      renderedImages.set(entry.id, png);
      if (plan.comparisons?.some(comparison => comparison.reference === entry.id || comparison.actual === entry.id)) images.set(entry.id, png);
      results.push({ id: entry.id, input: entry, parameters, issues, image: filename, sha256: digest(png) });
    }
  } finally {
    model.free();
    disposeRenderSessionCache(renderCache);
  }
  const comparisons = [];
  for (const comparison of plan.comparisons ?? []) {
    const pixels: Uint8ClampedArray[] = [];
    for (const id of [comparison.reference, comparison.actual]) {
      const canvas = createCanvas(project.canvas.width, project.canvas.height);
      const ctx = canvas.getContext('2d'); ctx.drawImage(await loadImage(images.get(id)!), 0, 0);
      pixels.push(ctx.getImageData(...comparison.region).data);
    }
    let maxDifference = 0, changedPixels = 0;
    for (let i = 0; i < pixels[0].length; i += 4) {
      const delta = Math.max(...[0, 1, 2, 3].map(channel => Math.abs(pixels[0][i + channel] - pixels[1][i + channel])));
      maxDifference = Math.max(maxDifference, delta);
      if (delta > (comparison.tolerance ?? 2)) changedPixels++;
    }
    comparisons.push({ ...comparison, maxDifference, changedPixels, pass: changedPixels <= (comparison.maxChangedPixels ?? 0) });
  }
  const lint = lintProjectJson(raw) as { severity: string; code: string; message: string }[];
  const issueById = new Map(results.map(result => [result.id, result.issues]));
  const contactPages: { image: string; sha256: string }[] = [];
  const pageCapacity = 4 * 36;
  for (let offset = 0; offset < cases.length; offset += pageCapacity) {
    const pageCases = cases.slice(offset, offset + pageCapacity);
    const contact = createCanvas(4 * 260, Math.max(1, Math.ceil(pageCases.length / 4)) * 220);
    const context = contact.getContext('2d');
    context.fillStyle = '#20242b';
    context.fillRect(0, 0, contact.width, contact.height);
    for (const [index, entry] of pageCases.entries()) {
      const png = renderedImages.get(entry.id);
      if (!png) continue;
      const x = (index % 4) * 260;
      const y = Math.floor(index / 4) * 220;
      const scale = Math.min(252 / project.canvas.width, 185 / project.canvas.height);
      context.drawImage(await loadImage(png), x + 4, y + 4, project.canvas.width * scale, project.canvas.height * scale);
      const issues = issueById.get(entry.id) ?? [];
      context.fillStyle = issues.length ? '#ff9d92' : '#eeeeee';
      context.font = '12px sans-serif';
      context.fillText(entry.id, x + 4, y + 206, 250);
    }
    const image = contactPages.length === 0 ? 'contact.png' : `contact-${contactPages.length + 1}.png`;
    const contactPng = contact.toBuffer('image/png');
    await fs.writeFile(path.join(outputDirectory, image), contactPng, { flag: 'wx' });
    contactPages.push({ image, sha256: digest(contactPng) });
  }
  const reportBody = {
    schemaVersion: 1, checkedAt: new Date().toISOString(), revision, renderer: 'headless-cpu',
    numericalPass: !lint.some(item => item.severity === 'error') && results.every(result => result.issues.length === 0) && comparisons.every(result => result.pass),
    visualReview: 'required', externalRuntime: 'not-tested', completeModelAccepted: false,
    lint, cases: results, comparisons,
    contact: {
      image: contactPages[0]?.image ?? 'contact.png',
      sha256: contactPages[0]?.sha256 ?? '',
      pages: contactPages,
    },
  };
  const report = { ...reportBody, reportDigest: digest(JSON.stringify(reportBody)) };
  await fs.writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  return report;
}

export async function checkAcceptanceRevision(projectPath: string, reportPath: string) {
  const { revision } = await readAcceptanceInputs(projectPath);
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const stale = report.revision?.sha256 !== revision.sha256;
  const damagedArtifacts: string[] = [];
  const contacts = Array.isArray(report.contact?.pages)
    ? report.contact.pages
    : report.contact
      ? [report.contact]
      : [];
  for (const artifact of [...(report.cases ?? []), ...contacts]) {
    const file = path.resolve(path.dirname(reportPath), artifact.image);
    if (path.dirname(file) !== path.resolve(path.dirname(reportPath))) throw new Error('Invalid report artifact path');
    const bytes = await fs.readFile(file).catch(() => null);
    if (!bytes || digest(bytes) !== artifact.sha256) damagedArtifacts.push(artifact.image);
  }
  const { reportDigest, ...reportBody } = report;
  const reportDigestValid = typeof reportDigest === 'string'
    && digest(JSON.stringify(reportBody)) === reportDigest;
  return {
    current: !stale && damagedArtifacts.length === 0 && reportDigestValid,
    stale,
    damagedArtifacts,
    reportDigestValid,
    expected: report.revision?.sha256,
    actual: revision.sha256,
  };
}
