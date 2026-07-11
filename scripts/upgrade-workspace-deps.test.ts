import assert from 'node:assert/strict'
import { it } from 'vitest'
import { createUpgradeWorkspaceDepsCommands } from './upgrade-workspace-deps'

it('runs generated catalog syncs before dependency upgrade changesets', () => {
  const commands = createUpgradeWorkspaceDepsCommands(['--latest'])

  assert.deepEqual(commands, [
    {
      command: 'pnpm',
      args: ['up', '-r', '-L', '-i', '--latest'],
    },
    {
      command: 'pnpm',
      args: ['dedupe', '--lockfile-only'],
    },
    {
      command: 'pnpm',
      args: ['run', 'check:rolldown:single-version'],
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
  ])
})
