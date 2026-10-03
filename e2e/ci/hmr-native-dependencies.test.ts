import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { NATIVE_BATCH_CLI } from '../utils/nativeBatchProject'
import { createNativeProfileProject, hasNativeProfileEntry, saveNativeProfileSource } from '../utils/nativeProfileProject'

describe.each(['classic', 'stateful-experimental'] as const)('native style and topology updates (%s)', (runtime) => {
  it('updates imported styles and publishes and revokes complete component and page outputs', async (context) => {
    const project = await createNativeProfileProject(runtime)
    const dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], { cwd: project, env: createDevProcessEnv(), all: true })
    context.onTestFailed(() => process.stdout.write(dev.getOutput()))
    const read = (file: string) => readFile(path.join(project, file), 'utf8')
    try {
      await dev.waitForInitialBuild()
      const userAsset = path.join(project, 'dist/user-owned.txt')
      await writeFile(userAsset, 'preserve user asset')
      const originalStyle = await read('src/styles/theme.wxss')
      for (const color of ['#456', '#789', '#123']) {
        await saveNativeProfileSource(project, 'styles/theme.wxss', originalStyle.replace('#123', color))
        await expect.poll(() => read('dist/pages/imported/index.wxss'), { timeout: 20_000 }).toContain(color)
      }
      for (const [configFile, target, field] of [
        ['pages/plain/index.json', 'components/optional/index', 'usingComponents'],
        ['app.json', 'pages/optional/index', 'pages'],
        ['isolated/pages/home/index.json', 'isolated/components/optional/index', 'usingComponents'],
      ] as const) {
        const original = await read(`src/${configFile}`)
        const config = JSON.parse(original) as { pages?: string[], usingComponents?: Record<string, string> }
        const updated = field === 'pages'
          ? { ...config, pages: [...config.pages ?? [], target] }
          : { ...config, usingComponents: { ...config.usingComponents, 'optional-card': `/${target}` } }
        for (let round = 0; round < 2; round += 1) {
          await saveNativeProfileSource(project, configFile, JSON.stringify(updated))
          await expect.poll(() => read(`dist/${configFile}`), { timeout: 20_000 }).toContain(target)
          await expect.poll(() => hasNativeProfileEntry(project, target), { timeout: 20_000 }).toEqual([true, true, true])
          await saveNativeProfileSource(project, configFile, original)
          await expect.poll(() => read(`dist/${configFile}`), { timeout: 20_000 }).not.toContain(target)
          await expect.poll(() => hasNativeProfileEntry(project, target), { timeout: 20_000 }).toEqual([false, false, false])
          expect(await readFile(userAsset, 'utf8')).toBe('preserve user asset')
        }
      }
      expect(dev.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
    }
    finally {
      await dev.stop()
      await rm(project, { recursive: true, force: true })
    }
  }, 150_000)
})
