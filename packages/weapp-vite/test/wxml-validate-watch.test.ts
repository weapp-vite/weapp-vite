import type { WatcherInstance } from '../src/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getFixture } from './utils'

const outputs = ['pages/native/index.wxml', 'pages/vue/index.wxml', 'sub/index.wxml', 'independent/index.wxml']

describe('WXML validation external dependencies', { concurrent: false }, () => {
  it.each(['classic', 'stateful-experimental'] as const)('retains successful artifacts through validation failure and recovers with %s', async (runtime) => {
    const project = await createTempFixtureProject(getFixture('wxml-remove'), 'wxml-validate-watch')
    const compiler = await createTestCompilerContext({
      cwd: project.tempDir,
      mode: 'transform-validate',
      isDev: true,
      inlineConfig: { weapp: { hmr: { runtime } }, build: { watch: { chokidar: { usePolling: true, interval: 100 } } } },
    })
    let watcher: WatcherInstance | undefined
    const failures: unknown[] = []
    const read = (file: string) => fs.readFile(path.join(project.tempDir, 'dist', file), 'utf8').catch(() => '')
    const waitForLabel = async (label: string) => {
      await expect.poll(async () => (await Promise.all(outputs.map(read))).every(code => code.includes(`data-rule="${label}"`) && code.includes('<!-- output-plugin -->')), { timeout: 45_000 }).toBe(true)
    }
    try {
      watcher = await compiler.ctx.buildService.build({ skipNpm: true }) as WatcherInstance
      await waitForLabel('initial')
      ;(watcher as WatcherInstance & { on: (name: string, cb: (event: { code: string, error?: unknown }) => void) => void }).on('event', (event) => {
        if (event.code === 'ERROR') {
          failures.push(event.error)
        }
      })
      await new Promise(resolve => setTimeout(resolve, 500))
      const rules = path.join(project.tempDir, 'validation-rules.json')
      const transformRules = path.join(project.tempDir, 'transform-rules.json')
      let failedCount = 0
      for (const reject of ['pages/', 'independent/']) {
        await fs.writeJSON(rules, { reject })
        await expect.poll(() => failures.length, { timeout: 45_000 }).toBeGreaterThan(failedCount)
        failedCount = failures.length
        const previous = await Promise.all(outputs.map(read))
        await fs.writeJSON(transformRules, { label: reject === 'pages/' ? 'main-retry' : 'child-retry' })
        await expect.poll(() => failures.length, { timeout: 45_000 }).toBeGreaterThan(failedCount)
        failedCount = failures.length
        expect(await Promise.all(outputs.map(read))).toEqual(previous)
        await fs.writeJSON(rules, {})
        await waitForLabel(reject === 'pages/' ? 'main-retry' : 'child-retry')
      }
      await fs.remove(rules)
      await expect.poll(() => failures.length, { timeout: 45_000 }).toBeGreaterThan(failedCount)
      await fs.writeJSON(rules, {})
      await fs.writeJSON(transformRules, { label: 'restored' })
      await waitForLabel('restored')
      for (const marker of ['first-edit', 'second-edit']) {
        await fs.appendFile(path.join(project.tempDir, 'src/pages/native/index.wxml'), `<view>${marker}</view>`)
        await expect.poll(() => read(outputs[0]!), { timeout: 45_000 }).toContain(marker)
      }
      const configFile = path.join(project.tempDir, 'vite.config.ts')
      const config = await fs.readFile(configFile, 'utf8')
      await fs.writeFile(configFile, config.replace('mode.includes(\'validate\') ? async', 'false ? async').replace('rules.label)', 'rules.label + \'-config\')'))
      await waitForLabel('restored-config')
    }
    finally {
      await watcher?.close()
      await compiler.ctx.watcherService.closeAll()
      await compiler.dispose()
      await project.cleanup()
    }
  }, 180_000)
})
