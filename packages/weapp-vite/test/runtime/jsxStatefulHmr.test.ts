import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createCompilerContext } from '../../src/createContext'
import logger from '../../src/logger'
import { StatefulHmrTransport } from '../../src/runtime/statefulHmr/transport'

function createBundleRuntime(root: string) {
  const rebuilds: unknown[] = []
  const context = createContext({
    console,
    setTimeout: () => 1,
    clearTimeout() {},
    App() {},
    Page() {},
    Component() {},
    Behavior: (definition: unknown) => definition,
    wx: {
      request(options: { data: { action: string, failure?: unknown }, success: (result: unknown) => void }) {
        if (options.data.action === 'register') {
          options.success({ statusCode: 200, data: { type: 'registered' } })
        }
        if (options.data.action === 'rebuild') {
          rebuilds.push(options.data.failure)
        }
        return { abort() {} }
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
    applyBatch(source: string) {
      runInContext(source, context, { filename: 'update.js', timeout: 5_000 })
      expect(rebuilds).toEqual([])
    },
    getImporters(id: string) {
      return runInContext(`globalThis.__rolldown_runtime__.getImporters(${JSON.stringify(id)})`, context) as string[]
    },
    getVersion() {
      return runInContext(`globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].getVersion()`, context) as number
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
  const controlSpy = vi.spyOn(StatefulHmrTransport.prototype, 'createControl')
  const page = `import {defineComponent} from 'wevu'
import Card from '../components/card.vue'
import {sharedFragment, createDynamicBlock} from '../shared'
export default defineComponent({data(){return {count:0}},methods:{increment(){this.count++}},render(){return <view><view className="title">initial-page</view><Card title="card"/>{sharedFragment}{createDynamicBlock(()=><button onTap={this.increment}>count:{this.count}</button>)}</view>}})`
  let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined
  try {
    await fs.ensureDir(path.dirname(source))
    await fs.ensureDir(path.join(cwd, 'src/components'))
    await fs.ensureSymlink(path.join(root, 'node_modules'), path.join(cwd, 'node_modules'), 'junction')
    await fs.writeJSON(path.join(cwd, 'package.json'), { name: 'jsx-stateful-probe', type: 'module' })
    await fs.writeJSON(path.join(cwd, 'project.config.json'), { appid: 'wx123', miniprogramRoot: 'dist/' })
    await fs.writeJSON(path.join(cwd, 'project.private.config.json'), { setting: { compileHotReLoad: true } })
    await fs.writeFile(path.join(cwd, 'vite.config.ts'), 'export default {weapp:{srcRoot:"src",hmr:{runtime:"stateful-experimental"}}}')
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
    const runtime = createBundleRuntime(path.join(cwd, 'dist'))
    runtime.load('app.js')
    runtime.load('pages/index.js')
    // 编译器 cwd 与 Vite root 不同时，首包依赖图仍须使用引擎的模块 ID。
    expect(runtime.getImporters(path.relative(cwd, shared))).toContain(path.relative(cwd, source))
    const control = controlSpy.mock.results.at(-1)?.value as ReturnType<StatefulHmrTransport['createControl']>
    const report = async (action: 'register' | 'poll', version: number) => {
      const response = await fetch(control.url, {
        method: 'POST',
        body: JSON.stringify({ ...control, action, version, sessionId: 'jsx-regression' }),
        signal: AbortSignal.timeout(30_000),
      })
      expect(response.ok).toBe(true)
      return response.json() as Promise<{ type: string, targetVersion: number }>
    }
    expect(await report('register', 0)).toMatchObject({ type: 'registered' })
    await fs.writeFile(shared, 'export const sharedFragment=<text>updated-shared</text>;export const createDynamicBlock=(factory)=>factory()')
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('updated-shared')
    expect(ctx.runtimeState.build.hmr).toBe(hmrState)
    expect(ctx.runtimeState.build.hmr.externalComponentEntryMap).toBe(componentEntries)
    const sharedBatch = await report('poll', 0)
    expect(sharedBatch.type).toBe('batch-published')
    expect(sharedBatch.targetVersion).toBeGreaterThan(0)
    runtime.applyBatch(await fs.readFile(path.join(cwd, 'dist/__weapp_vite_hmr/update.js'), 'utf8'))
    expect(runtime.getVersion()).toBe(sharedBatch.targetVersion)
    await fs.writeFile(source, page.replace('initial-page', 'updated-page').replace('this.count++', 'this.count += 2'))
    await expect.poll(async () => await fs.readFile(output, 'utf8'), { timeout: 30_000 }).toContain('updated-page')
    const pageBatch = await report('poll', sharedBatch.targetVersion)
    expect(pageBatch.type).toBe('batch-published')
    expect(pageBatch.targetVersion).toBeGreaterThan(sharedBatch.targetVersion)
    expect(await fs.readFile(path.join(cwd, 'dist/__weapp_vite_hmr/update.js'), 'utf8')).toContain('this.count += 2')
    runtime.applyBatch(await fs.readFile(path.join(cwd, 'dist/__weapp_vite_hmr/update.js'), 'utf8'))
    expect(runtime.getVersion()).toBe(pageBatch.targetVersion)
    await new Promise(resolve => setTimeout(resolve, 2_000))
    expect(createHash('sha256').update(await fs.readFile(controlPath)).digest('hex')).toBe(controlHash)
    expect(errors).toEqual([])
  }
  finally {
    await ctx?.watcherService.closeAll()
    errorSpy.mockRestore()
    controlSpy.mockRestore()
    await fs.remove(cwd)
  }
}, 120_000)
