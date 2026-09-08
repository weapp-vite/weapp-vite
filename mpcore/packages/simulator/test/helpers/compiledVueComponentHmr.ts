import type { RolldownOutput } from 'rolldown'
import type { StatefulHmrDevEngineUpdate } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/viteAdapter'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { dev } from 'rolldown/experimental'
import { compileVueFile } from 'wevu/compiler'
import { createLogicalEntryModuleCode } from '../../../../../packages/weapp-vite/src/moduleGraph/logicalEntry'
import { createLogicalEntryId } from '../../../../../packages/weapp-vite/src/moduleGraph/protocol'
import { isStatefulHmrBoundary } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/boundaries'
import { createStatefulHmrRolldownRuntimeSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/commonRuntime'
import { createStatefulHmrInitialGraph } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/initialModuleGraph'
import { compileVueSharedRuntime } from './compileVueSharedRuntime'

async function collectVueComponentHmr(repoRoot: string, source: string) {
  const runtime = await compileVueSharedRuntime(repoRoot)
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'vue-client-companion-')))
  const sourceId = path.join(root, 'index.vue').replaceAll('\\', '/')
  const ownerId = createLogicalEntryId(sourceId, 'component')
  await writeFile(sourceId, source)
  const compiled = await compileVueFile(source, sourceId, { isPage: false, skipComponentTransform: true })
  let output: RolldownOutput | undefined
  let buildError: Error | undefined
  let nextUpdate = Promise.withResolvers<StatefulHmrDevEngineUpdate>()
  const engine = await dev({
    cwd: root,
    input: ownerId,
    experimental: { devMode: { lazy: false, implement: createStatefulHmrRolldownRuntimeSource() } },
    plugins: [{
      name: 'real-vue-client-companion',
      resolveId(id) {
        if (id === ownerId || id === sourceId) {
          return id
        }
        if (id === 'wevu' || id.startsWith('virtual:weapp-vite/runtime')) {
          return path.join(root, 'vue-shared-runtime.js')
        }
      },
      async load(id) {
        if (id === path.join(root, 'vue-shared-runtime.js')) {
          return runtime.code
        }
        if (id === ownerId) {
          return createLogicalEntryModuleCode({ sourceId, type: 'component' }, [])
        }
        if (id === sourceId) {
          this.addWatchFile(sourceId)
          const result = await compileVueFile(await readFile(sourceId, 'utf8'), sourceId, { isPage: false, skipComponentTransform: true })
          if (typeof result.script !== 'string') {
            throw new TypeError('Expected an executable Vue script')
          }
          return result.script
        }
      },
      transform(code, id) {
        if (isStatefulHmrBoundary(id, root, [sourceId], new Set([sourceId]))) {
          return `${code}\nimport.meta.hot.accept();`
        }
      },
      renderChunk(code, chunk) {
        return `${code}${createStatefulHmrInitialGraph(chunk, this, root)}`
      },
    }],
  }, { format: 'cjs', entryFileNames: 'compiled-component.js' }, {
    watch: { skipWrite: true },
    onOutput(result) {
      if (result instanceof Error) {
        buildError = result
      }
      else { output = result }
    },
    onHmrUpdates(result) {
      if (result instanceof Error) {
        nextUpdate.reject(result)
      }
      else if (result.updates[0]) {
        nextUpdate.resolve(result.updates[0].update as StatefulHmrDevEngineUpdate)
      }
    },
  })
  const running = engine.run()
  const patches: Array<Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }>> = []
  let initialFiles: Array<[string, string]> = []
  try {
    await engine.registerClient('vue-client-companion')
    await engine.ensureCurrentBuildFinish()
    await engine.getBundleState()
    if (buildError) {
      throw buildError
    }
    if (!output) {
      throw new Error('Missing DevEngine initial output')
    }
    initialFiles = output.output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code])
    for (const updated of [source.replace('count.value += 1', 'count.value += 2').replace('step:1', 'step:2'), source]) {
      nextUpdate = Promise.withResolvers<StatefulHmrDevEngineUpdate>()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const timeout = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Vue companion native HMR event timed out')), 10_000)
        })
        await writeFile(sourceId, updated)
        const patch = await Promise.race([nextUpdate.promise, timeout])
        if (patch.type !== 'Patch') {
          throw new Error(`Expected Vue component patch, received ${patch.type}`)
        }
        patches.push(patch)
        await engine.notifyPayloadDelivered(patch.filename)
        // 回调先于原生监听路径提交；下一次写文件必须等完整 coordinator 事务结束。
        await engine.ensureCurrentBuildFinish()
        await engine.getBundleState()
      }
      finally {
        clearTimeout(timer)
      }
    }
  }
  finally {
    await engine.close()
    await running
    await rm(root, { recursive: true, force: true })
  }
  return { initialFiles, patched: patches[0]!, restored: patches[1]!, template: compiled.template }
}

const compiledFixtures = new Map<string, ReturnType<typeof collectVueComponentHmr>>()

/** 缓存真实引擎生成的首包和两次原生 watcher 补丁，浏览器与 Node 执行完全相同的 client 协议。 */
export function compileVueComponentHmr(repoRoot: string, source: string) {
  const key = `${repoRoot}:${source}`
  let compiled = compiledFixtures.get(key)
  if (!compiled) {
    compiled = collectVueComponentHmr(repoRoot, source)
    compiledFixtures.set(key, compiled)
  }
  return compiled
}
