import type { CAC } from 'cac'

interface McpCommandOptions {
  endpoint?: string
  host?: string
  port?: number | string
  transport?: 'stdio' | 'streamable-http'
  unref?: boolean
  workspaceRoot?: string
}

function resolvePort(port: McpCommandOptions['port']) {
  if (typeof port === 'number' && Number.isInteger(port)) {
    return port
  }
  if (typeof port === 'string' && port.trim()) {
    const parsed = Number.parseInt(port, 10)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }
}

export function registerMcpCommand(cli: CAC) {
  cli
    .command('mcp', 'start weapp-vite MCP server')
    .option('--transport <type>', '[string] stdio | streamable-http', { default: 'stdio' })
    .option('--host <host>', '[string] streamable-http host')
    .option('--port <port>', '[number] streamable-http port')
    .option('--endpoint <path>', '[string] streamable-http endpoint path')
    .option('--unref', '[boolean] unref HTTP server to not block process exit')
    .option('--workspace-root <path>', '[string] workspace root path, defaults to auto detect from cwd')
    .action(async (options: McpCommandOptions) => {
      const { startWeappViteMcpServer } = await import('../../mcp')
      await startWeappViteMcpServer({
        endpoint: options.endpoint,
        host: options.host,
        port: resolvePort(options.port),
        transport: options.transport,
        unref: options.unref,
        workspaceRoot: options.workspaceRoot,
      })
    })
}
