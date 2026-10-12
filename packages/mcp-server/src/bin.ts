#!/usr/bin/env node
import { runStdioServer } from './server.js';

runStdioServer().catch((err) => {
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});
