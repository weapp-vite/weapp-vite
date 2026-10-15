import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const runNode = promisify(execFile)

it('tracks and reloads config/plugin dependencies through the public compiler in a plain Node process', async () => {
  const worker = new URL('./fixtures/moduleDependencies.mjs', import.meta.url)
  const { stdout } = await runNode(process.execPath, [fileURLToPath(worker)], { timeout: 30_000 })
  const observations = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) as {
    kind: string
    identity: string
    phase: string
    dependencies: string[]
    initialWidth: boolean
    refreshedWidth: boolean
    staleWidth: boolean
    refreshedCandidate: boolean
    staleCandidate: boolean
  }[]
  expect(observations).toHaveLength(8)
  for (const observation of observations) {
    expect.soft(observation.dependencies, `${observation.kind}/${observation.identity}/${observation.phase}`).toContain(`src/${observation.kind}.ts`)
    expect.soft(observation, `${observation.kind}/${observation.identity}/${observation.phase}`).toMatchObject({ initialWidth: true, refreshedWidth: true, staleWidth: false, refreshedCandidate: true, staleCandidate: false })
  }
}, 35_000)
