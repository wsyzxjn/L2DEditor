import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export function writeFileAtomicSync(
  filePath: string,
  data: string | Uint8Array,
  options: { mode?: number } = {}
): void {
  const target = path.resolve(filePath);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.tmp-${process.pid}-${randomUUID()}`
  );
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporary, 'wx', options.mode ?? 0o644);
    fs.writeFileSync(descriptor, data);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, target);
    try {
      const directoryDescriptor = fs.openSync(directory, 'r');
      try {
        fs.fsyncSync(directoryDescriptor);
      } finally {
        fs.closeSync(directoryDescriptor);
      }
    } catch {
      // Directory fsync is not supported on every platform; the file itself is already durable.
    }
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original write failure.
      }
    }
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

export function safeResolveWithin(
  rootDirectory: string,
  relativePath: unknown,
  label: string
): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must not be an absolute path: ${relativePath}`);
  }
  const root = path.resolve(rootDirectory);
  const target = path.resolve(root, relativePath);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} escapes the bundle directory: ${relativePath}`);
  }
  return target;
}
