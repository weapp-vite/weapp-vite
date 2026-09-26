import type { RolldownOutput } from 'rolldown'
import type { StatefulHmrDevEngineUpdate } from './viteAdapter'
import { mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createContext, runInContext } from 'node:vm'
import { WEAPP_VITE_RUNTIME_VIRTUAL_ID } from '@weapp-core/constants'
import path from 'pathe'
import { dev } from 'rolldown/experimental'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryModuleCode } from '../../moduleGraph/logicalEntry'
import { createLogicalEntryId } from '../../moduleGraph/protocol'
import { isStatefulHmrBoundary } from './boundaries'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { createStatefulHmrInitialGraph } from './initialModuleGraph'

describe('registration owners in actual DevEngine output', () => {
  it.each(['component', 'page'] as const)('reexecutes the accepting %s owner across native HMR patches and restoration', async (kind) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'component-registration-owner-')))
    const source = path.join(root, kind === 'component' ? 'index.vue' : 'step.js')
    const pageSource = path.join(root, 'page.js')
    const owner = createLogicalEntryId(kind === 'component' ? source : pageSource, kind)
    const sourceCode = (step: number) => kind === 'component' ? `export default { increment: count => count + ${step} }` : `export const step = ${step}`
    const runtimeId = path.join(root, 'wevu.js')
    await writeFile(source, sourceCode(1))
    const outputs: RolldownOutput[] = []
    let nextUpdate = Promise.withResolvers<StatefulHmrDevEngineUpdate>()
    const engine = await dev({
      cwd: root,
      input: owner,
      experimental: { devMode: { lazy: false, implement: createStatefulHmrRolldownRuntimeSource() } },
      plugins: [{
        name: 'actual-registration-owner',
        resolveId(id) {
          if (id === owner || id === source || id === pageSource) {
            return id
          }
          if (id === WEAPP_VITE_RUNTIME_VIRTUAL_ID) {
            return runtimeId
          }
        },
        async load(id) {
          if (id === owner) {
            // 入口元数据读取同一源文件时，原生引擎会同时失效逻辑包装模块。
            this.addWatchFile(source)
            return createLogicalEntryModuleCode({ sourceId: kind === 'component' ? source : pageSource, type: kind }, [])
          }
          if (id === source) {
            this.addWatchFile(source)
            return await readFile(source, 'utf8')
          }
          if (id === pageSource) {
            return `import { step } from './step.js';
              const bridge = globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__;
              bridge.installNative('Page', definition => { globalThis.definition = definition; globalThis.registrations++; });
              bridge.Page({ data: { count: 0, input: '' }, increment() { this.setData({ count: this.data.count + step }); } });`
          }
          if (id === runtimeId) {
            return 'export function createWevuComponent(options) { globalThis.definition = options; globalThis.registrations++; }'
          }
        },
        transform(code, id) {
          if (isStatefulHmrBoundary(id, root, kind === 'component' ? [source] : [pageSource], new Set(kind === 'component' ? [source] : []))) {
            return `${code}\nimport.meta.hot.accept();`
          }
        },
        renderChunk(code, chunk) {
          return `${code}${createStatefulHmrInitialGraph(chunk, this, root)}`
        },
      }],
    }, { format: 'cjs', entryFileNames: 'component.js' }, {
      // 连续恢复等长源码时比较内容，避免宿主文件事件合并或时间戳精度影响回归结果。
      watch: { skipWrite: true, usePolling: true, pollInterval: 20, compareContentsForPolling: true },
      onHmrUpdates(result) {
        if (result instanceof Error) {
          nextUpdate.reject(result)
        }
        else if (result.updates[0]) {
          nextUpdate.resolve(result.updates[0].update as StatefulHmrDevEngineUpdate)
        }
      },
      onOutput(output) {
        if (output instanceof Error) {
          throw output
        }
        outputs.push(output)
      },
    })
    const running = engine.run()
    try {
      await engine.registerClient('registration-owner')
      await engine.ensureCurrentBuildFinish()
      await engine.getBundleState()
      const files = new Map(outputs.at(-1)!.output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code]))
      const context = createContext({ console, registrations: 0, setTimeout: () => {} })
      const loaded = new Map<string, { exports: unknown }>()
      context.require = (id: string) => {
        const name = id.replace(/^\.\//, '')
        if (loaded.has(name)) {
          return loaded.get(name)!.exports
        }
        const module = { exports: {} }
        loaded.set(name, module)
        const run = runInContext(`(function(require,module,exports){${files.get(name)}\n})`, context)
        run(context.require, module, module.exports)
        return module.exports
      }
      context.require('./component.js')
      const host = {
        data: { count: 0, input: 'held' },
        setData(data: object) {
          Object.assign(this.data, data)
        },
      }
      const initialDefinition = context.definition
      if (kind === 'page') {
        context.definition.onLoad.call(host)
        context.definition.increment.call(host)
        expect(host.data.count).toBe(1)
      }
      else {
        expect(context.definition.increment(1)).toBe(2)
      }
      expect(context.registrations).toBe(1)

      for (const step of [2, 1]) {
        nextUpdate = Promise.withResolvers<StatefulHmrDevEngineUpdate>()
        // 轮询可能读到 writeFile 截断后的空模块；以原子替换提交完整的一次源码更新。
        const pendingSource = `${source}.pending`
        await writeFile(pendingSource, sourceCode(step))
        await rename(pendingSource, source)
        let timer: ReturnType<typeof setTimeout> | undefined
        const changed = await Promise.race([nextUpdate.promise, new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Native engine HMR event timed out')), 5_000)
        })]).finally(() => clearTimeout(timer))
        expect(changed.type).toBe('Patch')
        if (changed.type !== 'Patch') {
          throw new Error('Expected a real DevEngine HMR patch')
        }
        const runtime = context.__rolldown_runtime__
        const bridge = context.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__
        bridge.beginUpdate()
        try {
          const prepared = runtime.prepareUpdate(changed.changedIds)
          runInContext(changed.code, context)
          runtime.applyPreparedUpdate(prepared)
        }
        finally { bridge.endUpdate() }
        await engine.notifyPayloadDelivered(changed.filename)
        // 回调先于原生监听路径提交；下一次写文件必须等完整 coordinator 事务结束。
        await engine.ensureCurrentBuildFinish()
        await engine.getBundleState()
        if (kind === 'component') {
          expect(runtime.loadExports('index.vue').default.increment(1)).toBe(1 + step)
          expect(context.definition.increment(1)).toBe(1 + step)
        }
        else {
          expect(context.definition).toBe(initialDefinition)
          expect(host.data.input).toBe('held')
          const previous = host.data.count
          context.definition.increment.call(host)
          expect(host.data.count).toBe(previous + step)
        }
      }
      expect(context.registrations).toBe(kind === 'component' ? 3 : 1)
    }
    finally {
      await engine.close()
      await running
      await rm(root, { recursive: true, force: true })
    }
  })
})
