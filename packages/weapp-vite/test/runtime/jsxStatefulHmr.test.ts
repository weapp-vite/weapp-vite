import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createCompilerContext } from '../../src/createContext'
import logger from '../../src/logger'
import { getHmrRuntimeSession } from '../../src/runtime/hmrRuntimeSession'
import { saveSource } from '../helpers/saveSource'

// 仅验证模拟宿主的 stateful 机制；真实 IDE 未证明在线交接，不计入稳定 IDE 验收。
vi.mock('../../src/runtime/hmrRuntimeHostCapabilities', () => ({ resolveStatefulHmrStartupFallback: () => undefined }))

function createBundleRuntime(root: string) {
  const rebuilds: unknown[] = []
  const requests: Array<{ action: string, version?: number, payloads?: string[] }> = []
  const pending = new Set<AbortController>()
  let closed = false
  const context = createContext({
    console,
    setTimeout,
    clearTimeout,
    App() {},
    Page() {},
    Component() {},
    Behavior: (definition: unknown) => definition,
    wx: {
      request(options: { url: string, data: { action: string, failure?: unknown }, success: (result: unknown) => void, fail?: (error: unknown) => void }) {
        const controller = new AbortController()
        pending.add(controller)
        const body = JSON.stringify(options.data)
        requests.push(JSON.parse(body))
        if (options.data.action === 'rebuild') {
          rebuilds.push(options.data.failure)
        }
        void fetch(options.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: controller.signal,
        }).then(async (response) => {
          const data = await response.json() as { type?: string }
          if (closed) {
            return
          }
          options.success({ statusCode: response.status, data })
          if (data.type === 'batch-published') {
            const source = readFileSync(path.join(root, '__weapp_vite_hmr/update.js'), 'utf8')
            runInContext(source, context, { filename: 'update.js', timeout: 5_000 })
          }
        }).catch((error) => {
          if (!closed && !controller.signal.aborted) {
            rebuilds.push(error)
            options.fail?.(error)
          }
        }).finally(() => pending.delete(controller))
        return { abort: () => controller.abort() }
      },
    },
  })
  const cache = new Map<string, { exports: unknown }>()
  function load(filename: string): unknown {
    const absolute = path.resolve(root, filename)
    const cached = cache.get(absolute)
    if (cached) {
      return cached.exports
    }
    const module = { exports: {} }
    cache.set(absolute, module)
    const source = readFileSync(absolute, 'utf8')
    const execute = runInContext(`(function(require,module,exports){${source}\n})`, context, { filename, timeout: 5_000 }) as (require: (id: string) => unknown, module: { exports: unknown }, exports: unknown) => void
    execute(id => load(path.resolve(path.dirname(absolute), id)), module, module.exports)
    return module.exports
  }
  return {
    load,
    requests,
    assertHealthy() {
      expect(rebuilds).toEqual([])
    },
    close() {
      closed = true
      runInContext(`globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]?.stop()`, context)
      for (const controller of pending) {
        controller.abort()
      }
    },
    getImporters(id: string) {
      return runInContext(`globalThis.__rolldown_runtime__.getImporters(${JSON.stringify(id)})`, context) as string[]
    },
    callPageMethod(id: string, method: string, state: Record<string, number>) {
      // VM 边界只收窄本 fixture 导出的 Options API 方法，执行后断言真实状态变化。
      const handler = runInContext(`globalThis.__rolldown_runtime__.loadExports(${JSON.stringify(id)}).default.methods[${JSON.stringify(method)}]`, context) as (this: Record<string, number>) => void
      handler.call(state)
    },
    getVersion() {
      return runInContext(`globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].getVersion()`, context) as number
    },
    isInitialReady() {
      return runInContext(`globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].getTransportState().initialReady`, context) === true
    },
  }
}

it.each(['minimal', 'demo'] as const)('keeps %s handlers stateful and transfers compiled JSX changes to classic', async (fixture) => {
  const root = path.resolve(import.meta.dirname, '../../../..')
  const fixtureParent = path.join(root, '.tmp/jsx-stateful-probe')
  await fs.ensureDir(fixtureParent)
  const cwd = await fs.mkdtemp(path.join(fixtureParent, 'fixture-'))
  const demo = fixture === 'demo'
  const route = demo ? 'pages/tsx-basic/index' : 'pages/index'
  const source = path.join(cwd, `src/${route}.tsx`)
  const shared = path.join(cwd, 'src/shared.tsx')
  const output = path.join(cwd, `dist/${route}.wxml`)
  const controlPath = path.join(cwd, 'dist/__weapp_vite_hmr/control.js')
  const errors: string[] = []
  const errorSpy = vi.spyOn(logger, 'error').mockImplementation((...messages) => {
    errors.push(messages.map(String).join(' '))
  })
  const minimalPage = `import {definePageJson} from 'weapp-vite'
import {defineComponent} from 'wevu'
import Card from '../components/card.vue'
import {sharedFragment, createDynamicBlock} from '../shared'
definePageJson({navigationBarTitleText:'JSX HMR'})
export default defineComponent({data(){return {count:0}},methods:{increment(){this.count++}},render(){return <view><view className="title">initial-page</view><Card title="card"/>{sharedFragment}{createDynamicBlock(()=><button onTap={this.increment}>count:{this.count}</button>)}</view>}})`
  const demoRoot = path.join(root, 'apps/wevu-jsx-tsx-demo')
  const page = demo
    ? (await fs.readFile(path.join(demoRoot, 'src/pages/tsx-basic/index.tsx'), 'utf8')).replace('纯 TSX（.tsx）', 'initial-page')
    : minimalPage
  const initialStep = demo ? 'this.islandCount += 1' : 'this.count++'
  const updatedStep = demo ? 'this.islandCount += 2' : 'this.count += 2'
  const sharedSource = demo
    ? (await fs.readFile(path.join(demoRoot, 'src/shared.tsx'), 'utf8')).replace('跨文件静态 JSX fragment', 'initial-shared')
    : 'export const sharedFragment=<text>initial-shared</text>;export const createDynamicBlock=(factory)=>factory()'
  const sharedWith = (marker: string) => sharedSource.replace('initial-shared', marker)
  let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined
  let runtime: ReturnType<typeof createBundleRuntime> | undefined
  try {
    if (demo) {
      await fs.copy(path.join(demoRoot, 'src'), path.join(cwd, 'src'))
    }
    await fs.ensureDir(path.dirname(source))
    await fs.ensureDir(path.join(cwd, 'src/components'))
    await fs.ensureSymlink(path.join(root, 'node_modules'), path.join(cwd, 'node_modules'), 'junction')
    await fs.writeJSON(path.join(cwd, 'package.json'), { name: 'jsx-stateful-probe', type: 'module' })
    await fs.writeJSON(path.join(cwd, 'project.config.json'), { appid: 'wx123', miniprogramRoot: 'dist/' })
    await fs.writeJSON(path.join(cwd, 'project.private.config.json'), { setting: { compileHotReLoad: true } })
    // 内容轮询确保等长修改可观察，测试仍验证真实引擎补丁及构建状态身份。
    await fs.writeFile(path.join(cwd, 'vite.config.ts'), 'export default {esbuild:{jsx:"preserve"},build:{watch:{chokidar:{usePolling:true,interval:50}}},weapp:{srcRoot:"src",hmr:{runtime:"stateful-experimental"}}}')
    if (!demo) {
      await fs.writeJSON(path.join(cwd, 'src/app.json'), { pages: [route] })
    }
    await fs.writeFile(path.join(cwd, 'src/app.ts'), 'App({})')
    await fs.writeFile(source, page)
    await fs.writeFile(shared, sharedSource)
    await fs.writeFile(path.join(cwd, 'src/components/card.vue'), '<script setup>defineProps({title:String})</script><template><view>{{title}}</view></template>')
    ctx = await createCompilerContext({ cwd, isDev: true, syncSupportFiles: false, emitDefaultAutoImportOutputs: false })
    const publicWatcher = await ctx.buildService.build({ skipNpm: true })
    const session = getHmrRuntimeSession(ctx)
    const hmrState = ctx.runtimeState.build.hmr
    const componentEntries = hmrState.externalComponentEntryMap
    expect(componentEntries.size).toBeGreaterThan(0)
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('initial-page')
    const controlHash = createHash('sha256').update(await fs.readFile(controlPath)).digest('hex')
    runtime = createBundleRuntime(path.join(cwd, 'dist'))
    runtime.load('app.js')
    runtime.load(`${route}.js`)
    const handlerState = { count: 0, islandCount: 0 }
    const handlerName = demo ? 'increaseIslandCount' : 'increment'
    const countKey = demo ? 'islandCount' : 'count'
    const assertHandlerStep = (step: number) => {
      const previous = handlerState[countKey]
      runtime!.callPageMethod(path.relative(cwd, source), handlerName, handlerState)
      expect(handlerState[countKey]).toBe(previous + step)
    }
    assertHandlerStep(1)
    // 编译器 cwd 与 Vite root 不同时，首包依赖图仍须使用引擎的模块 ID。
    expect(runtime.getImporters(path.relative(cwd, shared))).toContain(path.relative(cwd, source))
    await expect.poll(() => runtime!.requests.some(request =>
      request.payloads?.includes('app.js') && request.payloads.includes(`${route}.js`),
    ), { timeout: 30_000 }).toBe(true)
    await expect.poll(() => runtime!.isInitialReady(), { timeout: 30_000 }).toBe(true)
    const initialVersion = runtime.getVersion()
    await saveSource(source, page.replace(initialStep, updatedStep))
    await expect.poll(() => {
      runtime!.assertHealthy()
      expect(errors).toEqual([])
      return runtime!.getVersion()
    }, { timeout: 30_000 }).toBeGreaterThan(initialVersion)
    expect(await fs.readFile(output, 'utf8')).toContain('initial-page')
    expect(ctx.runtimeState.build.hmr).toBe(hmrState)
    expect(ctx.runtimeState.build.hmr.externalComponentEntryMap).toBe(componentEntries)
    expect(session.phase).toBe('stateful')
    expect(session.fallback).toBeUndefined()
    expect(createHash('sha256').update(await fs.readFile(controlPath)).digest('hex')).toBe(controlHash)
    runtime.assertHealthy()
    expect(await fs.readFile(path.join(cwd, 'dist/__weapp_vite_hmr/update.js'), 'utf8')).toContain(updatedStep)
    assertHandlerStep(2)
    expect(ctx.moduleGraphService.getEntryDependencies(source)).toContainEqual({ kind: 'jsx', sourceId: shared })
    const componentSource = path.join(cwd, demo ? 'src/components/info-card/index.vue' : 'src/components/card.vue')
    expect(ctx.moduleGraphService.collectAffectedEntries(componentSource, 'script')).toContain(source)

    // VM 不模拟 IDE 完整重载；保留真实客户端直到宿主完成能力切换，再验证 classic 原生产物。
    const statefulVersion = runtime.getVersion()
    await saveSource(shared, sharedWith('updated-shared'))
    await expect.poll(() => session.phase, { timeout: 30_000 }).toBe('classic')
    await session.whenSettled()
    runtime.close()
    expect(runtime.getVersion()).toBe(statefulVersion)
    expect(session.fallback).toMatchObject({ code: 'native-registration', files: [source] })
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('updated-shared')
    expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(publicWatcher)

    await saveSource(source, page.replace('initial-page', 'updated-page').replace(initialStep, updatedStep))
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('updated-page')
    expect(await fs.readFile(output, 'utf8')).toContain('updated-shared')
    expect(session.phase).toBe('classic')
    // A→B→A 恢复仍由已移交的原生 watcher 构建，不能重新激活旧 stateful 引擎。
    for (const [file, content, marker] of [
      [shared, sharedWith('restored-shared'), 'restored-shared'],
      [source, page, 'initial-page'],
      [shared, sharedSource, 'initial-shared'],
    ]) {
      await saveSource(file, content)
      await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain(marker)
      expect(session.phase).toBe('classic')
      expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(publicWatcher)
    }
    expect(errors).toEqual([])
  }
  finally {
    runtime?.close()
    await ctx?.watcherService.closeAll()
    // 直接创建的上下文由调用方持有命令级配置 owner，所有 watcher 退出后再恢复请求值。
    if (ctx) {
      await getHmrRuntimeSession(ctx).classicIdeConfig.close()
    }
    expect(await fs.readJSON(path.join(cwd, 'project.private.config.json'))).toEqual({ setting: { compileHotReLoad: true } })
    errorSpy.mockRestore()
    await fs.remove(cwd)
  }
}, 120_000)
