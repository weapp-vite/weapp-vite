/* eslint-disable antfu/no-top-level-await -- CLI executable lifecycle. */
import process from 'node:process'
import { cac } from 'cac'
import { registerAcceptCommand } from './cli/commands/accept'
import { registerMcpCommand } from './cli/commands/mcp'
import { VERSION } from './constants'

// Keep model-free tools independent of compiler/plugin initialization.
const cli = cac('weapp-vite')
cli.option('-c, --config <file>', 'Vite configuration for explicit HTTP onboarding only')
registerAcceptCommand(cli)
registerMcpCommand(cli)
cli.option('--base <path>', 'public base path')
  .option('-l, --logLevel <level>', 'info | warn | error | silent')
  .option('--clearScreen', 'allow/disable clear screen when logging')
  .option('-d, --debug [feat]', 'show debug logs')
  .option('-f, --filter <filter>', 'filter debug logs')
  .option('-m, --mode <mode>', 'set env mode')
cli.help()
cli.version(VERSION)
try {
  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
}
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
