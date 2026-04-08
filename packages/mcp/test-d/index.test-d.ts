import type { McpServerHandle, StartMcpServerOptions } from '@weapp-vite/mcp'
import {
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  startStdioServer,
  startWeappViteMcpServer,
} from '@weapp-vite/mcp'
import { expectError, expectType } from 'tsd'

expectType<'/mcp'>(DEFAULT_MCP_ENDPOINT)
expectType<'127.0.0.1'>(DEFAULT_MCP_HOST)
expectType<3088>(DEFAULT_MCP_PORT)

const options: StartMcpServerOptions = {
  endpoint: '/mcp',
  host: '127.0.0.1',
  port: 3088,
  quiet: true,
  transport: 'streamable-http',
  unref: true,
  workspaceRoot: '/tmp/workspace',
}

expectType<'stdio' | 'streamable-http' | undefined>(options.transport)
expectType<Promise<void>>(startStdioServer({
  workspaceRoot: '/tmp/workspace',
}))
expectType<Promise<McpServerHandle>>(startWeappViteMcpServer(options))

expectError<StartMcpServerOptions>({
  transport: 'http',
})
