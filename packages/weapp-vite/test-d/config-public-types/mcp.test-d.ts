import type { createWeappViteMcpServer as createServer } from '@weapp-vite/mcp'
import type { WeappViteMcpServerHandle } from 'weapp-vite/mcp'
import { expectAssignable, expectType } from 'tsd'
import {
  createWeappViteMcpServer,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_RUNTIME_REST_ENDPOINT,
  resolveProjectMcpPort,
  resolveWeappMcpConfig,
  startWeappViteMcpServer,
} from 'weapp-vite/mcp'

expectType<'/mcp'>(DEFAULT_MCP_ENDPOINT)
expectType<'127.0.0.1'>(DEFAULT_MCP_HOST)
expectType<3088>(DEFAULT_MCP_PORT)
expectType<'/api/weapp/devtools'>(DEFAULT_RUNTIME_REST_ENDPOINT)
expectType<number>(resolveProjectMcpPort('project'))
expectType<boolean>(resolveWeappMcpConfig(false).enabled)
expectAssignable<typeof createServer>(createWeappViteMcpServer)
expectType<ReturnType<typeof createServer>>(createWeappViteMcpServer())
expectType<Promise<WeappViteMcpServerHandle>>(startWeappViteMcpServer())
