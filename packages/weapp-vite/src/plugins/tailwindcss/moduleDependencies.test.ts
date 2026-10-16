import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const runNode = promisify(execFile)

it.each([{ args: [] }, { args: ['--no-experimental-strip-types'] }])('tracks and reloads config/plugin dependencies using the framework generation policy (%j)', async ({ args }) => {
  const worker = new URL('./fixtures/moduleDependencies.mjs', import.meta.url)
  const { stdout } = await runNode(process.execPath, [...args, fileURLToPath(worker)], { timeout: 30_000 })
  const observations = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) as {
    kind: string
    identity: string
    phase: string
    spelling: string
    error?: string
    dependencies: string[]
    initialWidth: boolean
    refreshedWidth: boolean
    staleWidth: boolean
    refreshedCandidate: boolean
    staleCandidate: boolean
  }[]
  expect(observations).toHaveLength(16)
  for (const observation of observations) {
    const context = JSON.stringify(observation)
    expect.soft(observation.error, context).toBeUndefined()
    expect.soft(observation, context).toMatchObject({ dependencies: expect.arrayContaining([`src/${observation.kind}.ts`]), sourceHasModule: true, moduleInvalidation: true, initialWidth: true, refreshedWidth: true, staleWidth: false, refreshedCandidate: true, staleCandidate: false })
    if (observation.phase === 'introduced') {
      expect.soft(observation, context).toMatchObject({ entryInvalidation: true })
    }
  }
}, 35_000)
