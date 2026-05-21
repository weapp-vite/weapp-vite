import process from 'node:process'
import { startWeappIdeMcpServer } from '../mcp'

export interface McpCommandOptions {
  workspaceRoot?: string
}

function readOptionValue(argv: readonly string[], optionName: string) {
  const optionWithEqual = `${optionName}=`
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (token === optionName) {
      const value = argv[index + 1]
      return typeof value === 'string' ? value : undefined
    }

    if (token.startsWith(optionWithEqual)) {
      return token.slice(optionWithEqual.length)
    }
  }
}

function shouldPrintHelp(argv: readonly string[]) {
  return argv.includes('-h') || argv.includes('--help')
}

function printMcpHelp() {
  process.stdout.write(`Usage: weapp mcp [options]

Start the weapp-ide-cli MCP server over stdio.

Options:
  --workspace-root <path>  Resolve relative project/output paths from this root
  -h, --help              Show this help

AI client stdio config:
{
  "mcpServers": {
    "weapp-ide-cli": {
      "command": "weapp",
      "args": ["mcp", "--workspace-root", "<repo-root>"]
    }
  }
}
`)
}

export async function runMcpCommand(argv: string[]) {
  if (shouldPrintHelp(argv)) {
    printMcpHelp()
    return
  }

  await startWeappIdeMcpServer({
    workspaceRoot: readOptionValue(argv, '--workspace-root'),
  })
}
