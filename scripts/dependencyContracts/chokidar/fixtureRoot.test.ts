import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { createContractFixtureRoot } from './supervisor.mjs'

it('uses one physical ownership root when the temporary parent is an alias', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'chokidar-fixture-alias-'))
  try {
    const physical = path.join(workspace, 'physical')
    const alias = path.join(workspace, 'alias')
    await mkdir(physical)
    await symlink(physical, alias, process.platform === 'win32' ? 'junction' : 'dir')
    const fixture = await createContractFixtureRoot(alias)
    expect(path.dirname(fixture)).toBe(await realpath(physical))
    expect(await realpath(fixture)).toBe(fixture)
    expect(path.basename(fixture)).toMatch(/^chokidar-contracts-/)
    const worker = await mkdtemp(path.join(fixture, 'scenario-'))
    expect(path.relative(fixture, worker)).toBe(path.basename(worker))
  }
  finally { await rm(workspace, { recursive: true, force: true }) }
})
