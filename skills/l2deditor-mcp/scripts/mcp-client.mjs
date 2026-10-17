#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const { values } = parseArgs({
  options: {
    repo: { type: 'string', default: process.cwd() },
    'editor-url': { type: 'string' },
    list: { type: 'boolean', default: false },
    tool: { type: 'string' },
    args: { type: 'string', default: '{}' },
    'args-file': { type: 'string' },
    out: { type: 'string' },
  },
});
const repo = path.resolve(values.repo);
const serverEntry = path.join(repo, 'packages/mcp-server/dist/bin.js');
if (!fs.existsSync(serverEntry)) throw new Error(`Missing built MCP server: ${serverEntry}. Build the existing workspace first.`);
if (!values.list && !values.tool) throw new Error('Use --list or --tool <discovered-tool-name>.');
const endpoint = values['editor-url'] ?? process.env.L2D_EDITOR_URL ?? 'ws://127.0.0.1:22033';
const url = new URL(endpoint);
if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Only a loopback ws:// editor URL is allowed.');
const workspaceRequire = createRequire(path.join(repo, 'packages/mcp-server/package.json'));
// Resolve the existing workspace SDK instead of installing one into the skill.
const { Client } = await import(pathToFileURL(workspaceRequire.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
const { StdioClientTransport } = await import(pathToFileURL(workspaceRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href);
const client = new Client({ name: 'l2deditor-skill-client', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath, args: [serverEntry], cwd: repo,
  env: { ...process.env, L2D_EDITOR_URL: endpoint }, stderr: 'inherit',
});
try {
  await client.connect(transport);
  const discovered = await client.listTools();
  if (values.list) {
    console.log(JSON.stringify(discovered, null, 2));
  } else {
    if (!discovered.tools.some(tool => tool.name === values.tool)) throw new Error(`Tool '${values.tool}' was not discovered.`);
    const args = JSON.parse(values['args-file'] ? fs.readFileSync(path.resolve(values['args-file']), 'utf8') : values.args);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be a JSON object.');
    const result = await client.callTool({ name: values.tool, arguments: args }, undefined, { timeout: 30000 });
    let imageIndex = 0;
    const content = result.content.map(block => {
      if (block.type !== 'image') return block;
      const bytes = Buffer.from(block.data, 'base64');
      let savedPath;
      if (values.out) {
        const target = path.resolve(values.out);
        const parsed = path.parse(target);
        savedPath = imageIndex === 0 ? target : path.join(parsed.dir, `${parsed.name}-${imageIndex}${parsed.ext}`);
        fs.mkdirSync(path.dirname(savedPath), { recursive: true });
        fs.writeFileSync(savedPath, bytes);
      }
      imageIndex++;
      return { type: 'image', mimeType: block.mimeType, bytes: bytes.length, ...(savedPath ? { savedPath } : { note: 'Use --out to save image bytes.' }) };
    });
    console.log(JSON.stringify({ ...result, content }, null, 2));
    if (result.isError) process.exitCode = 1;
  }
} finally {
  await client.close();
  await transport.close();
}
