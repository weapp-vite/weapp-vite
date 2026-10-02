import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { compareBenchmarkOutputs, snapshotBenchmarkOutputs } from './outputScope'

it('compares final disk bytes including additions and removals outside the entry file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-output-scope-'))
  try {
    await mkdir(path.join(root, 'shared'))
    await writeFile(path.join(root, 'shared/style.wxss'), 'old')
    await writeFile(path.join(root, 'removed.js'), 'removed')
    await writeFile(path.join(root, 'retained.json'), '{}')
    const before = await snapshotBenchmarkOutputs(root)
    await writeFile(path.join(root, 'shared/style.wxss'), 'new')
    await writeFile(path.join(root, 'added.wxml'), '更新')
    await rm(path.join(root, 'removed.js'))
    expect(compareBenchmarkOutputs(before, await snapshotBenchmarkOutputs(root))).toEqual({
      added: ['added.wxml'],
      changed: ['shared/style.wxss'],
      removed: ['removed.js'],
      changedBytes: 9,
    })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
