import type { RolldownOutput } from 'rolldown'
import type { StatefulHmrDevEngineUpdate } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/viteAdapter'
import { mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
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
  let nextUpdate: PromiseWithResolvers<StatefulHmrDevEngineUpdate> | undefined
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
    // 连续等长修改与还原使用内容轮询，避免宿主文件事件合并导致漏报。
    watch: { skipWrite: true, usePolling: true, pollInterval: 20, compareContentsForPolling: true },
    onOutput(result) {
      if (result instanceof Error) {
        buildError = result
        nextUpdate?.reject(result)
      }
      else { output = result }
    },
    onHmrUpdates(result) {
      if (result instanceof Error) {
        nextUpdate?.reject(result)
      }
      else if (result.updates[0]) {
        nextUpdate?.resolve(result.updates[0].update as StatefulHmrDevEngineUpdate)
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
    const patchedSource = source
      .replace('count.value += 1', 'count.value += 2')
      .replace('step:1', 'step:2')
      .replace('STATEFUL-VUE-BASE', 'STATEFUL-VUE-PATCHED')
    const repatchedSource = patchedSource
      .replace('count.value += 2', 'count.value += 3')
      .replace('step:2', 'step:3')
    for (const updated of [patchedSource, repatchedSource, source]) {
      // 与注册 owner 回归保持一致：原子替换源码，避免轮询读取截断后的半成品。
      const pendingSource = `${sourceId}.pending`
      await writeFile(pendingSource, updated)
      const update = Promise.withResolvers<StatefulHmrDevEngineUpdate>()
      nextUpdate = update
      const timer = setTimeout(() => update.reject(new Error('Vue companion native HMR event timed out')), 10_000)
      try {
        const [patch] = await Promise.all([update.promise, rename(pendingSource, sourceId)])
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
        nextUpdate = undefined
      }
    }
  }
  finally {
    await engine.close()
    await running
    await rm(root, { recursive: true, force: true })
  }
  return { initialFiles, patched: patches[0]!, repatched: patches[1]!, restored: patches[2]!, template: compiled.template }
}

const compiledFixtures = new Map<string, ReturnType<typeof collectVueComponentHmr>>()

/** 缓存真实引擎生成的首包和连续更新、还原补丁，浏览器与 Node 执行完全相同的 client 协议。 */
export function compileVueComponentHmr(repoRoot: string, source: string) {
  const key = `${repoRoot}:${source}`
  let compiled = compiledFixtures.get(key)
  if (!compiled) {
    compiled = collectVueComponentHmr(repoRoot, source)
    compiledFixtures.set(key, compiled)
  }
  return compiled
}
