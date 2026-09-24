import type { WatcherInstance } from '../src/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getFixture } from './utils'

const outputs = ['pages/native/index.wxml', 'pages/vue/index.wxml', 'sub/index.wxml', 'independent/index.wxml']

async function waitForOutputs(root: string, label: string) {
  await expect.poll(async () => {
    const contents = await Promise.all(outputs.map(file => fs.readFile(path.join(root, 'dist', file), 'utf8').catch(() => '')))
    return contents.every(code => code.includes(`data-rule="${label}"`))
  }, { timeout: 45_000, interval: 100 }).toBe(true)
  for (const file of outputs) {
    const code = await fs.readFile(path.join(root, 'dist', file), 'utf8')
    expect(code.match(/<!-- transform-once -->/g), file).toHaveLength(1)
  }
}

describe('WXML transform external dependencies', { concurrent: false }, () => {
  it.each(['classic', 'stateful-experimental'] as const)('rebuilds all templates and recovers from missing dependencies with %s', async (runtime) => {
    const project = await createTempFixtureProject(getFixture('wxml-remove'), 'wxml-transform-watch')
    const compiler = await createTestCompilerContext({
      cwd: project.tempDir,
      mode: 'transform',
      isDev: true,
      inlineConfig: {
        weapp: { hmr: { runtime } },
        build: { watch: { chokidar: { usePolling: true, interval: 100 } } },
      },
    })
    let watcher: WatcherInstance | undefined
    try {
      watcher = await compiler.ctx.buildService.build({ skipNpm: true }) as WatcherInstance
      await waitForOutputs(project.tempDir, 'initial')
      // 等待原生 watcher 完成首轮注册后，使用真实磁盘事件驱动重建。
      await new Promise(resolve => setTimeout(resolve, 500))
      const rules = path.join(project.tempDir, 'transform-rules.json')
      await fs.writeJSON(rules, { label: 'changed' })
      await waitForOutputs(project.tempDir, 'changed')
      const failures: unknown[] = []
      ;(watcher as WatcherInstance & { on: (name: string, cb: (event: { code: string, error?: unknown }) => void) => void }).on('event', (event) => {
        if (event.code === 'ERROR') {
          failures.push(event.error)
        }
      })
      await fs.remove(rules)
      await expect.poll(() => failures.length, { timeout: 45_000 }).toBeGreaterThan(0)
      const previous = await fs.readFile(path.join(project.tempDir, 'dist/pages/native/index.wxml'), 'utf8')
      expect(previous).toContain('data-rule="changed"')
      await fs.writeJSON(rules, { label: 'restored' })
      await waitForOutputs(project.tempDir, 'restored')
      const source = path.join(project.tempDir, 'src/pages/native/index.wxml')
      for (const marker of ['first-edit', 'second-edit']) {
        await fs.appendFile(source, `<view>${marker}</view>`)
        await expect.poll(async () => fs.readFile(path.join(project.tempDir, 'dist/pages/native/index.wxml'), 'utf8'), { timeout: 45_000 }).toContain(marker)
        await waitForOutputs(project.tempDir, 'restored')
      }
      const config = path.join(project.tempDir, 'vite.config.ts')
      const originalConfig = await fs.readFile(config, 'utf8')
      await fs.writeFile(config, originalConfig.replace('rules.label)', 'rules.label + \'-config\')'))
      await waitForOutputs(project.tempDir, 'restored-config')
    }
    finally {
      await watcher?.close()
      await compiler.ctx.watcherService.closeAll()
      await compiler.dispose()
      await project.cleanup()
    }
  }, 180_000)
})
