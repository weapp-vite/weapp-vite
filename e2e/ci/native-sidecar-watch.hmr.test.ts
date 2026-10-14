import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createNativeBatchProject, NATIVE_BATCH_CLI } from '../utils/nativeBatchProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

describe.each(['classic', 'stateful-experimental'] as const)('standalone JSON sidecar watch (%s)', (runtime) => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  beforeAll(async () => {
    project = await createNativeBatchProject(runtime)
    const appFile = path.join(project, 'src/app.json')
    const app = JSON.parse(await readFile(appFile, 'utf8')) as Record<string, unknown>
    await writeFile(appFile, JSON.stringify({ ...app, sitemapLocation: 'sitemap.json' }))
    await writeFile(path.join(project, 'src/sitemap.json'), '{"desc":"SIDECAR_INITIAL","rules":[]}')
    dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
  }, 120_000)
  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: () => {},
      stopDev: async () => { await dev?.stop() },
    })
  }, 60_000)

  it('publishes edits and restoration without a script or template change', async (context) => {
    context.onTestFailed(() => process.stdout.write(dev?.getOutput().slice(-12_000) ?? ''))
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    const source = path.join(project, 'src/sitemap.json')
    const output = path.join(project, 'dist/sitemap.json')
    await expect.poll(() => readFile(output, 'utf8')).toContain('SIDECAR_INITIAL')
    for (const marker of ['SIDECAR_FIRST', 'SIDECAR_NEXT', 'SIDECAR_INITIAL']) {
      await writeFile(`${source}.pending`, JSON.stringify({ desc: marker, rules: [] }))
      await renameAtomicFile(`${source}.pending`, source)
      await expect.poll(() => readFile(output, 'utf8'), { timeout: 30_000 }).toContain(marker)
    }
    expect(dev!.getOutput()).not.toMatch(/Build failed|delivery failed/)
  }, 120_000)
})
