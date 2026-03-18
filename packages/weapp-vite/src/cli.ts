import type { GlobalCLIOptions } from './cli/types'
import process from 'node:process'
import { cac } from 'cac'
import path from 'pathe'
import { registerAnalyzeCommand } from './cli/commands/analyze'
import { registerBuildCommand } from './cli/commands/build'
import { registerGenerateCommand } from './cli/commands/generate'
import { registerInitCommand } from './cli/commands/init'
import { registerMcpCommand } from './cli/commands/mcp'
import { registerNpmCommand } from './cli/commands/npm'
import { registerOpenCommand } from './cli/commands/open'
import { registerPrepareCommand } from './cli/commands/prepare'
import { registerServeCommand } from './cli/commands/serve'
import { handleCLIError } from './cli/error'
import { tryRunIdeCommand } from './cli/ide'
import { maybeAutoStartMcpServer } from './cli/mcpAutoStart'
import { convertBase } from './cli/options'
import { VERSION } from './constants'
import { syncManagedTsconfigBootstrapFiles } from './runtime/tsconfigSupport'
import { checkRuntime } from './utils'

const cli = cac('weapp-vite')

try {
  checkRuntime({
    bun: '0.0.0',
    deno: '0.0.0',
    node: '^20.19.0 || >=22.12.0',
  })
}
catch {

}

cli
  .option('-c, --config <file>', `[string] use specified config file`)
  .option('--base <path>', `[string] public base path (default: /)`, {
    type: [convertBase],
  })
  .option('-l, --logLevel <level>', `[string] info | warn | error | silent`)
  .option('--clearScreen', `[boolean] allow/disable clear screen when logging`)
  .option('-d, --debug [feat]', `[string | boolean] show debug logs`)
  .option('-f, --filter <filter>', `[string] filter debug logs`)
  .option('-m, --mode <mode>', `[string] set env mode`)

registerServeCommand(cli)
registerBuildCommand(cli)
registerAnalyzeCommand(cli)
registerInitCommand(cli)
registerOpenCommand(cli)
registerPrepareCommand(cli)
registerNpmCommand(cli)
registerGenerateCommand(cli)
registerMcpCommand(cli)

cli.help()
cli.version(VERSION)

const skipManagedTsconfigBootstrapCommands = new Set([
  'g',
  'generate',
  'init',
  'mcp',
  'npm',
])

function resolveManagedTsconfigBootstrapRoot(args: string[]) {
  const [firstArg, secondArg] = args
  if (!firstArg || firstArg === '--help' || firstArg === '-h' || firstArg === '--version' || firstArg === '-v') {
    return undefined
  }
  if (firstArg.startsWith('-')) {
    return process.cwd()
  }
  if (skipManagedTsconfigBootstrapCommands.has(firstArg)) {
    return undefined
  }
  if (['analyze', 'build', 'dev', 'open', 'prepare', 'serve'].includes(firstArg)) {
    if (secondArg && !secondArg.startsWith('-')) {
      return path.resolve(secondArg)
    }
    return process.cwd()
  }
  return path.resolve(firstArg)
}

try {
  Promise.resolve()
    .then(async () => {
      const args = process.argv.slice(2)
      const forwarded = await tryRunIdeCommand(args)
      if (forwarded) {
        return
      }
      const managedTsconfigBootstrapRoot = resolveManagedTsconfigBootstrapRoot(args)
      if (managedTsconfigBootstrapRoot) {
        await syncManagedTsconfigBootstrapFiles(managedTsconfigBootstrapRoot)
      }
      cli.parse(process.argv, { run: false })
      await maybeAutoStartMcpServer(args, cli.options as GlobalCLIOptions)
      await cli.runMatchedCommand()
    })
    .catch((error) => {
      handleCLIError(error)
      process.exitCode = 1
    })
}
catch (error) {
  handleCLIError(error)
  process.exitCode = 1
}
