import type { RolldownOutput } from 'rolldown'
import type { StatefulHmrDevEngineUpdate } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/viteAdapter'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { dev } from 'rolldown/experimental'
import { compileVueFile, resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { renameAtomicFile } from '../../../../../e2e/utils/hmrAtomicRename'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from '../../../../../packages/weapp-vite/src/moduleGraph/logicalEntry'
import { createLogicalEntryId, createSidecarSourceSpecifier, parseSidecarModuleId, parseSidecarSourceRequest } from '../../../../../packages/weapp-vite/src/moduleGraph/protocol'
import { isStatefulHmrBoundary } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/boundaries'
import { createStatefulHmrRolldownRuntimeSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/commonRuntime'
import { createStatefulHmrHostFormatPlugin } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/hostFormat'
import { toStableModuleId } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/initialModuleGraph'
import { createStatefulHmrSidecarModuleCode } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/sidecarPlugin'
import { compileVueSharedRuntime } from './compileVueSharedRuntime'

interface VueHmrSequenceOptions {
  type: 'component' | 'page'
  modules?: Record<string, string>
  /** 仅客户端低层伴随测试显式提交模板资产；生产编译模板注册变化仍须回退 classic。 */
  templateAssetDelivery?: boolean
}

async function collectVueHmrSequence(repoRoot: string, source: string, updates: string[], options: VueHmrSequenceOptions) {
  const { type, modules = {}, templateAssetDelivery = false } = options
  const runtime = await compileVueSharedRuntime(repoRoot)
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'vue-client-companion-')))
  const sourceId = path.join(root, 'index.vue').replaceAll('\\', '/')
  const ownerId = createLogicalEntryId(sourceId, type)
  const compileOptions = { isPage: type === 'page', skipComponentTransform: type === 'component' }
  const delegatedEntries = new Set(type === 'component' ? [sourceId] : [])
  await writeFile(sourceId, source)
  const compiled = await compileVueFile(source, sourceId, compileOptions)
  let previousSource = source
  let previousCompiled = compiled
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
        if (id in modules) {
          return id
        }
        if (id === ownerId || id === sourceId || parseSidecarModuleId(id) || parseSidecarSourceRequest(id)) {
          return id
        }
        if (id === 'wevu' || id.startsWith('virtual:weapp-vite/runtime')) {
          return path.join(root, 'vue-shared-runtime.js')
        }
      },
      async load(id) {
        if (id in modules) {
          return { code: modules[id]!, moduleType: 'ts' }
        }
        if (id === path.join(root, 'vue-shared-runtime.js')) {
          return runtime.code
        }
        if (id === ownerId) {
          // 脚本侧车只持有依赖身份；低层客户端伴随测试以独立模板边观察宿主资产提交。
          // 此边不进入生产页面图，也不声明 Vue 编译模板可以保留状态更新。
          return createLogicalEntryModuleCode({ sourceId, type }, type === 'page'
            ? [{ kind: 'script', sourceId }, ...(templateAssetDelivery ? [{ kind: 'template' as const, sourceId }] : [])]
            : [])
        }
        const sidecar = parseSidecarModuleId(id)
        if (sidecar) {
          return createSidecarModuleCode(sidecar.ownerId, sidecar.sourceId, sidecar.kind)
        }
        const request = parseSidecarSourceRequest(id)
        if (request) {
          this.addWatchFile(request.sourceId)
          return { code: createStatefulHmrSidecarModuleCode(id, await readFile(request.sourceId, 'utf8'))!, moduleSideEffects: 'no-treeshake' }
        }
        if (id === sourceId) {
          this.addWatchFile(sourceId)
          const result = await compileVueFile(await readFile(sourceId, 'utf8'), sourceId, compileOptions)
          if (typeof result.script !== 'string') {
            throw new TypeError('Expected an executable Vue script')
          }
          return result.script
        }
      },
      transform(code, id) {
        if (isStatefulHmrBoundary(id, root, [sourceId], delegatedEntries)) {
          return `${code}\nimport.meta.hot.accept();`
        }
      },
    }, createStatefulHmrHostFormatPlugin()],
  }, { format: 'esm', entryFileNames: 'compiled-component.js' }, {
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
  const templates: string[] = []
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
    for (const updated of updates) {
      // 与注册 owner 回归保持一致：原子替换源码，避免轮询读取截断后的半成品。
      const pendingSource = `${sourceId}.pending`
      await writeFile(pendingSource, updated)
      const update = Promise.withResolvers<StatefulHmrDevEngineUpdate>()
      nextUpdate = update
      const timer = setTimeout(() => update.reject(new Error('Vue companion native HMR event timed out')), 10_000)
      try {
        const [patch] = await Promise.all([update.promise, renameAtomicFile(pendingSource, sourceId)])
        if (patch.type !== 'Patch') {
          throw new Error(`Expected Vue ${type} patch, received ${patch.type}`)
        }
        const currentCompiled = await compileVueFile(updated, sourceId, compileOptions)
        if (templateAssetDelivery) {
          const changedIds = patch.changedIds
          assert(Array.isArray(changedIds), 'Template asset companion requires changed module IDs')
          // 与正式适配器使用同一 cwd-relative runtime ID，保留查询参数中的模板边及 owner 身份。
          const changedModuleIds = changedIds.map(id => toStableModuleId(id, root))
          const changedModuleDiagnostics = JSON.stringify({ changedIds, changedModuleIds })
          const before = resolveVueSfcHmrSignatures(previousSource, sourceId).blockSignatures
          const after = resolveVueSfcHmrSignatures(updated, sourceId).blockSignatures
          assert(before && after, 'Template asset companion requires valid Vue block signatures')
          if (before.script === after.script && before.template !== after.template) {
            assert.equal(currentCompiled.script, previousCompiled.script, 'Template-only asset delivery must not invent an executable script change')
            const templateRequest = toStableModuleId(createSidecarSourceSpecifier(sourceId, sourceId, 'template'), root)
            assert(changedModuleIds.includes(templateRequest), `Template asset delivery must include its real template source request ${JSON.stringify(templateRequest)}; actual=${changedModuleDiagnostics}`)
          }
          if (before.script !== after.script) {
            assert.notEqual(currentCompiled.script, previousCompiled.script, 'Script delivery requires a changed executable module')
            assert(changedModuleIds.includes(toStableModuleId(sourceId, root)), `Script delivery must include its executing source module; actual=${changedModuleDiagnostics}`)
          }
        }
        patches.push(patch)
        templates.push(currentCompiled.template ?? '')
        await engine.notifyPayloadDelivered(patch.filename)
        // 回调先于原生监听路径提交；下一次写文件必须等完整 coordinator 事务结束。
        await engine.ensureCurrentBuildFinish()
        await engine.getBundleState()
        previousSource = updated
        previousCompiled = currentCompiled
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
  return { initialFiles, patches, templates, template: compiled.template }
}

const compiledFixtures = new Map<string, ReturnType<typeof collectVueHmrSequence>>()

/** 缓存真实引擎生成的首包、模板与补丁，浏览器和 Node 使用同一编辑序列。 */
export function compileVueHmrSequence(repoRoot: string, source: string, updates: string[], options: VueHmrSequenceOptions) {
  const key = JSON.stringify([repoRoot, source, updates, options])
  let compiled = compiledFixtures.get(key)
  if (!compiled) {
    compiled = collectVueHmrSequence(repoRoot, source, updates, options)
    compiledFixtures.set(key, compiled)
  }
  return compiled
}

/** 保留子组件连续脚本更新与恢复的共享 fixture。 */
export async function compileVueComponentHmr(repoRoot: string, source: string, modules: Record<string, string> = {}) {
  const patchedSource = source
    .replace('count.value += 1', 'count.value += 2')
    .replace('store.increment(1)', 'store.increment(2)')
    .replace('step:1', 'step:2')
    .replace('STATEFUL-VUE-BASE', 'STATEFUL-VUE-PATCHED')
  const repatchedSource = patchedSource
    .replace('count.value += 2', 'count.value += 3')
    .replace('store.increment(2)', 'store.increment(3)')
    .replace('step:2', 'step:3')
  const compiled = await compileVueHmrSequence(repoRoot, source, [patchedSource, repatchedSource, source, patchedSource], { type: 'component', modules })
  return { ...compiled, patched: compiled.patches[0]!, repatched: compiled.patches[1]!, restored: compiled.patches[2]!, patchedAgain: compiled.patches[3]! }
}
