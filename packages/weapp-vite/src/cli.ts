import process from 'node:process'
import { cac } from 'cac'
import { registerAnalyzeCommand } from './cli/commands/analyze'
import { registerBuildCommand } from './cli/commands/build'
import { registerGenerateCommand } from './cli/commands/generate'
import { registerInitCommand } from './cli/commands/init'
import { registerNpmCommand } from './cli/commands/npm'
import { registerOpenCommand } from './cli/commands/open'
import { registerServeCommand } from './cli/commands/serve'
import { handleCLIError } from './cli/error'
import { convertBase } from './cli/options'
import { VERSION } from './constants'
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
registerNpmCommand(cli)
registerGenerateCommand(cli)

cli.help()
cli.version(VERSION)

try {
  cli.parse(process.argv, { run: false })
  Promise.resolve()
    .then(() => cli.runMatchedCommand())
    .catch((error) => {
      handleCLIError(error)
      process.exitCode = 1
    })
}
catch (error) {
  handleCLIError(error)
  process.exitCode = 1
}
