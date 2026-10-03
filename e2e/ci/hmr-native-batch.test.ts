import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createNativeBatchProject, NATIVE_BATCH_CLI, NATIVE_BATCH_STEPS, readNativeBatchOutput, readNativeBatchSources, writeNativeBatch } from '../utils/nativeBatchProject'

describe.each(['classic', 'stateful-experimental'] as const)('native four-file batch (%s)', (runtime) => {
  it('publishes every member on first, repeated, reversed and restored saves', async (context) => {
    const project = await createNativeBatchProject(runtime)
    const source = await readNativeBatchSources(project)
    const dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
      all: true,
    })
    context.onTestFailed(() => {
      process.stdout.write(dev.getOutput().slice(-16_000))
    })
    const assertBatch = async (marker: string) => {
      await expect.poll(() => readNativeBatchOutput(project, marker), { timeout: 15_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
    }
    try {
      await dev.waitForInitialBuild()
      await assertBatch('BATCH_BASE')
      const appJson = await readFile(path.join(project, 'dist/app.json'), 'utf8')
      const userAsset = path.join(project, 'dist/user-owned.txt')
      await writeFile(userAsset, 'preserve-user-file')
      for (const [index, step] of NATIVE_BATCH_STEPS.slice(1).entries()) {
        await writeNativeBatch(project, source, step, index % 2 === 1)
        await assertBatch(step.marker)
        expect(await readFile(path.join(project, 'dist/pages/index/index.wxss'), 'utf8')).toContain(step.color)
        expect(await readFile(path.join(project, 'dist/app.json'), 'utf8')).toBe(appJson)
        expect(await readFile(userAsset, 'utf8')).toBe('preserve-user-file')
      }
      expect(dev.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
    }
    finally {
      await dev.stop()
      await rm(project, { recursive: true, force: true })
    }
  }, 90_000)
})
