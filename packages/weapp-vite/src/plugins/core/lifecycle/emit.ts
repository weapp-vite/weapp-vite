import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { isTemplate } from '../../../utils'
import { recordHmrProfileDuration } from '../../../utils/hmrProfile'
import { normalizeWatchPath } from '../../../utils/path'
import { emitWxmlAssetsWithCache } from '../../utils/wxmlEmit'
import { emitJsonAssets } from '../helpers'
import { createGenerateBundleHook } from './emit/generate'

function shouldEmitJsonDuringRenderStart(state: CorePluginState) {
  const { ctx, hmrState } = state
  if (
    !ctx.configService.isDev
    || !hmrState.hasBuiltOnce
    || hmrState.didEmitAllEntries
  ) {
    return true
  }

  const dirtyReasons = ctx.runtimeState.build.hmr.profile.dirtyReasonSummary
  if (!dirtyReasons?.length) {
    return true
  }

  return dirtyReasons.some(reason =>
    reason.startsWith('json-sidecar:')
    || reason.startsWith('entry-json-only:')
    || reason.startsWith('config-restart:')
    || reason.startsWith('auto-routes-topology:')
    || reason.startsWith('app-shell-dependent:')
    || reason.startsWith('layout-self:')
    || reason.startsWith('layout-dependent:')
    || reason.startsWith('layout-fallback-full:'),
  )
}

function resolveIncrementalHmrWxmlTargetIds(state: CorePluginState) {
  const { ctx, hmrState, entriesMap } = state
  if (
    !ctx.configService.isDev
    || !hmrState.hasBuiltOnce
    || hmrState.didEmitAllEntries
  ) {
    return undefined
  }

  const targets = new Set<string>()
  const entryIds = hmrState.lastHmrEntryIds?.size
    ? hmrState.lastHmrEntryIds
    : hmrState.lastEmittedEntryIds

  for (const entryId of entryIds ?? []) {
    // 原生 layout 通过组件包裹页面，不在页面 WXML 的 import/include 图中。
    // 先纳入入口已登记的模板所有权，再统一展开其嵌套模板依赖。
    for (const dependency of ctx.moduleGraphService?.getEntryDependencies(entryId) ?? []) {
      const template = normalizeWatchPath(dependency.sourceId)
      if (isTemplate(template)) {
        targets.add(template)
      }
    }
    const candidates = [
      entryId,
      ctx.configService.relativeAbsoluteSrcRoot(entryId),
      removeExtensionDeep(entryId),
      removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(entryId)),
    ]
    for (const candidate of candidates) {
      const entry = entriesMap.get(candidate)
      if (entry && 'templatePath' in entry && entry.templatePath) {
        targets.add(normalizeWatchPath(entry.templatePath))
      }
    }
  }

  // 目标属于当前已加载入口；不能读取构建期间继续增长的 watcher 事件队列。
  const pending = [...targets]
  while (pending.length) {
    const current = pending.pop()!
    for (const dependency of ctx.wxmlService?.depsMap?.get(current) ?? []) {
      const template = normalizeWatchPath(dependency)
      if (isTemplate(template) && !targets.has(template)) {
        targets.add(template)
        pending.push(template)
      }
    }
  }
  return targets.size ? targets : undefined
}

export function createRenderStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, buildTarget } = state

  return async function renderStart(this: any) {
    const startedAt = performance.now()
    try {
      const runtime: WxmlEmitRuntime = {
        emitFile: (asset) => {
          this.emitFile(asset)
        },
      }
      if (shouldEmitJsonDuringRenderStart(state)) {
        emitJsonAssets.call(this, state)
      }
      const targetIds = resolveIncrementalHmrWxmlTargetIds(state)
      state.watchFilesSnapshot = emitWxmlAssetsWithCache({
        runtime,
        compiler: ctx,
        subPackageMeta,
        emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
        buildTarget,
        targetIds,
      })
    }
    finally {
      recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'renderStartMs', performance.now() - startedAt)
    }
  }
}

export { createGenerateBundleHook }
