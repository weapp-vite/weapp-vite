import type { WatcherInstance } from '../src/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { getWxmlWatchFiles } from '../src/wxml/processing/dependencies'
import { createTempFixtureProject, createTestCompilerContext, getFixture } from './utils'

const outputs = ['pages/native/index.wxml', 'pages/vue/index.wxml', 'sub/index.wxml', 'independent/index.wxml']

async function waitForOutputs(root: string, label: string) {
  await expect.poll(async () => {
    // 原生写出期间文件可能暂时不完整；标签与转换次数必须检查同一次读取。
    return Promise.all(outputs.map(async (file) => {
      const code = await fs.readFile(path.join(root, 'dist', file), 'utf8').catch(() => '')
      return { file, label: code.includes(`data-rule="${label}"`), transforms: code.match(/<!-- transform-once -->/g)?.length ?? 0 }
    }))
  }, { timeout: 45_000, interval: 100 }).toEqual(outputs.map(file => ({ file, label: true, transforms: 1 })))
}

describe('WXML transform external dependencies', { concurrent: false }, () => {
  it.each(['classic', 'stateful-experimental'] as const)('rebuilds all templates and recovers from missing dependencies with %s', async (runtime) => {
    const project = await createTempFixtureProject(getFixture('wxml-remove'), 'wxml-transform-watch')
    const dependencyEvents: string[] = []
    const compiler = await createTestCompilerContext({
      cwd: project.tempDir,
      mode: 'transform',
      isDev: true,
      inlineConfig: {
        plugins: [{
          name: 'test:wxml-dependency-watch-diagnostics',
          configureServer(server) {
            server.watcher.on('all', (event, file) => {
              if (path.basename(file) === 'transform-rules.json') {
                dependencyEvents.push(event)
              }
            })
          },
        }],
        weapp: { hmr: { runtime } },
        build: { watch: { chokidar: { usePolling: true, interval: 100 } } },
      },
    })
    let watcher: WatcherInstance | undefined
    try {
      watcher = await compiler.ctx.buildService.build({ skipNpm: true }) as WatcherInstance
      const failures: unknown[] = []
      ;(watcher as WatcherInstance & { on: (name: string, cb: (event: { code: string, error?: unknown }) => void) => void }).on('event', (event) => {
        if (event.code === 'ERROR') {
          failures.push(event.error)
        }
      })
      await waitForOutputs(project.tempDir, 'initial')
      // 等待原生 watcher 完成首轮注册后，使用真实磁盘事件驱动重建。
      await new Promise(resolve => setTimeout(resolve, 500))
      // 独立子构建没有自己的 watcher，源码依赖必须交给主构建监听。
      const independentSource = path.join(project.tempDir, 'src/independent/index.wxml')
      expect(compiler.ctx.runtimeState.build.independent.watchFiles.get('independent')).toContain(independentSource)
      for (const marker of ['independent-first', 'independent-second']) {
        const previousProfile = compiler.ctx.runtimeState.build.hmr.recentProfiles.at(-1)
        await fs.appendFile(independentSource, `<view>${marker}</view>`)
        await expect.poll(async () => fs.readFile(path.join(project.tempDir, 'dist/independent/index.wxml'), 'utf8'), { timeout: 45_000 }).toContain(marker)
        await waitForOutputs(project.tempDir, 'initial')
        if (runtime === 'classic') {
          // 产物写入先于 END；等待本轮 profile，不能读取上一轮样本。
          await expect.poll(() => compiler.ctx.runtimeState.build.hmr.recentProfiles.at(-1), { timeout: 45_000, interval: 100 }).not.toBe(previousProfile)
          const profile = compiler.ctx.runtimeState.build.hmr.recentProfiles.at(-1)
          expect(profile?.dirtyReasonSummary).not.toContainEqual(expect.stringMatching(/^snapshot-full:/))
          expect(profile?.dirtyCount ?? 0).toBe(0)
        }
      }
      const rules = path.join(project.tempDir, 'transform-rules.json')
      const independentInput = await fs.readFile(independentSource, 'utf8')
      const previousOutputs = await Promise.all(outputs.map(file => fs.readFile(path.join(project.tempDir, 'dist', file), 'utf8')))
      await fs.appendFile(independentSource, '<view data-subtree-visited />')
      await expect.poll(() => failures.length, { timeout: 45_000 }).toBeGreaterThan(0)
      expect(await Promise.all(outputs.map(file => fs.readFile(path.join(project.tempDir, 'dist', file), 'utf8')))).toEqual(previousOutputs)
      await fs.writeFile(independentSource, `${independentInput}<view>independent-recovered</view>`)
      await expect.poll(async () => fs.readFile(path.join(project.tempDir, 'dist/independent/index.wxml'), 'utf8'), { timeout: 45_000 }).toContain('independent-recovered')
      await fs.writeJSON(rules, { label: 'changed' })
      await waitForOutputs(project.tempDir, 'changed')
      const previousFailures = failures.length
      await fs.remove(rules)
      // 超时时保留宿主事件与依赖登记状态，区分漏报事件、依赖丢失与构建未报错。
      await expect.poll(() => ({
        newFailure: failures.length > previousFailures,
        failureCount: failures.length,
        dependencyRegistered: getWxmlWatchFiles(compiler.ctx).includes(rules),
        hostEvents: [...dependencyEvents],
      }), { timeout: 45_000 }).toMatchObject({ newFailure: true })
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
      expect(compiler.ctx.runtimeState.build.independent.watchFiles.size).toBe(0)
      expect(compiler.ctx.runtimeState.build.independent.watchListeners.size).toBe(0)
      await compiler.dispose()
      await project.cleanup()
    }
  }, 180_000)
})
