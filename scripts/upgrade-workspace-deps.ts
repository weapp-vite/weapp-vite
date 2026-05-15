import process from 'node:process'
import { fileURLToPath } from 'node:url'
/* eslint-disable e18e/ban-dependencies -- cross-platform process launching should use execa per repository guidance. */
import { execa } from 'execa'

export interface UpgradeWorkspaceDepsCommand {
  command: string
  args: string[]
}

export function createUpgradeWorkspaceDepsCommands(extraArgs: string[]): UpgradeWorkspaceDepsCommand[] {
  return [
    {
      command: 'pnpm',
      args: ['up', '-r', '-L', '-i', ...extraArgs],
    },
    {
      command: 'pnpm',
      args: ['run', 'catalog:sync:weapi'],
    },
    {
      command: 'pnpm',
      args: ['run', 'catalog:sync:create-weapp-vite'],
    },
    {
      command: 'node',
      args: ['--import', 'tsx', 'scripts/generate-dependency-upgrade-changeset.ts', '--base', 'HEAD'],
    },
    {
      command: 'node',
      args: ['--import', 'tsx', 'scripts/generate-catalog-changeset.ts', '--base', 'HEAD'],
    },
  ]
}

export async function runUpgradeWorkspaceDeps(extraArgs = process.argv.slice(2)) {
  for (const command of createUpgradeWorkspaceDepsCommands(extraArgs)) {
    await execa(command.command, command.args, {
      stdio: 'inherit',
    })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runUpgradeWorkspaceDeps()
}
