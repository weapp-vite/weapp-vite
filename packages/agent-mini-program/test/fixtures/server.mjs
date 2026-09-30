import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'
const server = new McpServer({ name: 'test', version: '1' })
server.registerTool('echo', { inputSchema: z.object({ text: z.string() }), annotations: { readOnlyHint: true } }, async ({ text }) => ({ content: [{ type: 'text', text }] }))
await server.connect(new StdioServerTransport())
