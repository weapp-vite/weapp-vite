import type { CAC } from 'cac'

interface McpCommandOptions {
  workspaceRoot?: string
}

export function registerMcpCommand(cli: CAC) {
  cli
    .command('mcp', 'start weapp-vite MCP stdio server')
    .option('--workspace-root <path>', '[string] workspace root path, defaults to auto detect from cwd')
    .action(async (options: McpCommandOptions) => {
      const { startWeappViteMcpServer } = await import('../../mcp')
      await startWeappViteMcpServer({
        workspaceRoot: options.workspaceRoot,
      })
    })
}
