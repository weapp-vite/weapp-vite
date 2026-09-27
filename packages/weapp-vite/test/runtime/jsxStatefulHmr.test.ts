import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createCompilerContext } from '../../src/createContext'
import logger from '../../src/logger'

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
    getVersion() {
      return runInContext(`globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].getVersion()`, context) as number
    },
    isInitialReady() {
      return runInContext(`globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].getTransportState().initialReady`, context) === true
    },
  }
}

it('updates shared JSX and page handlers without replacing the active DevEngine build', async () => {
  const root = path.resolve(import.meta.dirname, '../../../..')
  const fixtureParent = path.join(root, '.tmp/jsx-stateful-probe')
  await fs.ensureDir(fixtureParent)
  const cwd = await fs.mkdtemp(path.join(fixtureParent, 'fixture-'))
  const source = path.join(cwd, 'src/pages/index.tsx')
  const shared = path.join(cwd, 'src/shared.tsx')
  const output = path.join(cwd, 'dist/pages/index.wxml')
  const controlPath = path.join(cwd, 'dist/__weapp_vite_hmr/control.js')
  const errors: string[] = []
  const errorSpy = vi.spyOn(logger, 'error').mockImplementation((...messages) => {
    errors.push(messages.map(String).join(' '))
  })
  const page = `import {defineComponent} from 'wevu'
import Card from '../components/card.vue'
import {sharedFragment, createDynamicBlock} from '../shared'
export default defineComponent({data(){return {count:0}},methods:{increment(){this.count++}},render(){return <view><view className="title">initial-page</view><Card title="card"/>{sharedFragment}{createDynamicBlock(()=><button onTap={this.increment}>count:{this.count}</button>)}</view>}})`
  let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined
  let runtime: ReturnType<typeof createBundleRuntime> | undefined
  try {
    await fs.ensureDir(path.dirname(source))
    await fs.ensureDir(path.join(cwd, 'src/components'))
    await fs.ensureSymlink(path.join(root, 'node_modules'), path.join(cwd, 'node_modules'), 'junction')
    await fs.writeJSON(path.join(cwd, 'package.json'), { name: 'jsx-stateful-probe', type: 'module' })
    await fs.writeJSON(path.join(cwd, 'project.config.json'), { appid: 'wx123', miniprogramRoot: 'dist/' })
    await fs.writeJSON(path.join(cwd, 'project.private.config.json'), { setting: { compileHotReLoad: true } })
    // 内容轮询确保等长修改可观察，测试仍验证真实引擎补丁及构建状态身份。
    await fs.writeFile(path.join(cwd, 'vite.config.ts'), 'export default {build:{watch:{chokidar:{usePolling:true,interval:50}}},weapp:{srcRoot:"src",hmr:{runtime:"stateful-experimental"}}}')
    await fs.writeJSON(path.join(cwd, 'src/app.json'), { pages: ['pages/index'] })
    await fs.writeFile(path.join(cwd, 'src/app.ts'), 'App({})')
    await fs.writeFile(source, page)
    await fs.writeFile(shared, 'export const sharedFragment=<text>initial-shared</text>;export const createDynamicBlock=(factory)=>factory()')
    await fs.writeFile(path.join(cwd, 'src/components/card.vue'), '<script setup>defineProps({title:String})</script><template><view>{{title}}</view></template>')
    ctx = await createCompilerContext({ cwd, isDev: true, syncSupportFiles: false, emitDefaultAutoImportOutputs: false })
    await ctx.buildService.build({ skipNpm: true })
    const hmrState = ctx.runtimeState.build.hmr
    const componentEntries = hmrState.externalComponentEntryMap
    expect(componentEntries.size).toBeGreaterThan(0)
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('initial-page')
    const controlHash = createHash('sha256').update(await fs.readFile(controlPath)).digest('hex')
    runtime = createBundleRuntime(path.join(cwd, 'dist'))
    runtime.load('app.js')
    runtime.load('pages/index.js')
    // 编译器 cwd 与 Vite root 不同时，首包依赖图仍须使用引擎的模块 ID。
    expect(runtime.getImporters(path.relative(cwd, shared))).toContain(path.relative(cwd, source))
    await expect.poll(() => runtime!.requests.some(request =>
      request.payloads?.includes('app.js') && request.payloads.includes('pages/index.js'),
    ), { timeout: 30_000 }).toBe(true)
    await expect.poll(() => runtime!.isInitialReady(), { timeout: 30_000 }).toBe(true)
    await fs.writeFile(shared, 'export const sharedFragment=<text>updated-shared</text>;export const createDynamicBlock=(factory)=>factory()')
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('updated-shared')
    expect(ctx.runtimeState.build.hmr).toBe(hmrState)
    expect(ctx.runtimeState.build.hmr.externalComponentEntryMap).toBe(componentEntries)
    await expect.poll(() => {
      runtime!.assertHealthy()
      expect(errors).toEqual([])
      return runtime!.getVersion()
    }, { timeout: 30_000 }).toBeGreaterThan(0)
    const sharedVersion = runtime.getVersion()
    runtime.assertHealthy()
    await fs.writeFile(source, page.replace('initial-page', 'updated-page').replace('this.count++', 'this.count += 2'))
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('updated-page')
    await expect.poll(() => {
      runtime!.assertHealthy()
      expect(errors).toEqual([])
      return runtime!.getVersion()
    }, { timeout: 30_000 }).toBeGreaterThan(sharedVersion)
    expect(await fs.readFile(path.join(cwd, 'dist/__weapp_vite_hmr/update.js'), 'utf8')).toContain('this.count += 2')
    runtime.assertHealthy()
    // 源码 transform 继续拥有共享 JSX；恢复也必须由实际客户端执行并确认。
    expect(ctx.moduleGraphService.getEntryDependencies(source)).toContainEqual({ kind: 'jsx', sourceId: shared })
    let version = runtime.getVersion()
    for (const [file, content, marker] of [
      [shared, 'export const sharedFragment=<text>restored-shared</text>;export const createDynamicBlock=(factory)=>factory()', 'restored-shared'],
      [source, page, 'initial-page'],
    ]) {
      await fs.writeFile(file, content)
      await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain(marker)
      await expect.poll(() => {
        runtime.assertHealthy()
        return runtime.getVersion()
      }, { timeout: 30_000 }).toBeGreaterThan(version)
      version = runtime.getVersion()
      expect(ctx.runtimeState.build.hmr).toBe(hmrState)
    }
    await new Promise(resolve => setTimeout(resolve, 2_000))
    expect(createHash('sha256').update(await fs.readFile(controlPath)).digest('hex')).toBe(controlHash)
    expect(errors).toEqual([])
  }
  finally {
    runtime?.close()
    await ctx?.watcherService.closeAll()
    errorSpy.mockRestore()
    await fs.remove(cwd)
  }
}, 120_000)
