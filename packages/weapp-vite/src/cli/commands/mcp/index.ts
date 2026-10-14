import type { CAC } from 'cac'
import type { McpCommandOptions } from './types'

export function registerMcpCommand(cli: CAC) {
  cli
    .command('mcp [...args]', 'start weapp-vite MCP server or manage MCP client onboarding')
    .option('--transport <type>', '[string] stdio | streamable-http | command | http', { default: 'stdio' })
    .option('--host <host>', '[string] streamable-http host')
    .option('--port <port>', '[number] streamable-http port')
    .option('--endpoint <path>', '[string] streamable-http endpoint path')
    .option('--rest-endpoint <path>', '[string] streamable-http REST runtime endpoint path')
    .option('--no-rest', '[boolean] disable streamable-http REST runtime endpoints')
    .option('--unref', '[boolean] unref HTTP server to not block process exit')
    .option('--url <url>', '[string] explicit HTTP MCP url')
    .option('--workspace-root <path>', '[string] workspace root path, defaults to cwd')
    .option('-y, --yes', '[boolean] write config without prompt')
    .action(async (args: string[], options: McpCommandOptions) => {
      const { runMcpCommand } = await import('./action')
      return runMcpCommand(args, options)
    })
}
