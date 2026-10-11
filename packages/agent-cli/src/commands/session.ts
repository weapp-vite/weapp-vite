import type { Command } from 'commander'
import process from 'node:process'
import { Session } from '@weapp-agent/core'
import { findProjectRoot } from '@weapp-agent/mini-program'

export function registerSessionCommands(
  program: Command,
  output: (value: unknown, json: boolean) => void,
): void {
  program
    .command('sessions')
    .description('List sessions for this project')
    .option('--details', 'include prompts, status, usage and pending tool calls')
    .action(async (_local, command) => {
      const options = command.optsWithGlobals()
      const root = await findProjectRoot(options.cwd)
      output(
        options.details ? await Session.listSummaries(root) : await Session.list(root),
        Boolean(options.json),
      )
    })

  program
    .command('session')
    .description('Inspect a saved session without starting a model or replaying tools')
    .argument('<session>', 'session ID')
    .action(async (session, _local, command) => {
      const options = command.optsWithGlobals()
      const summary = await Session.inspect(await findProjectRoot(options.cwd), session)
      output(summary, Boolean(options.json))
      if (summary.status === 'invalid') {
        process.exitCode = 1
      }
    })
}
