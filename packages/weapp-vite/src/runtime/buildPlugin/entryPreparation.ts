import type { CompilerContext } from '../../context'
import type { AppEntry } from '../../types'
import { capturePreparationInputs } from './entryPreparationInputs'

interface EntryPreparation {
  generation: object
  snapshot?: {
    runtime: CompilerContext['runtimeState']
    ownership: EntryPreparationOwnership
    app: AppEntry
    routes: string | undefined
    routesDirty: boolean
    routesNeedRescan: boolean
    pending: CompilerContext['runtimeState']['build']['independent']['pendingOutputs']
    roots: Array<[string, unknown]>
  }
}

interface EntryPreparationOwnership {
  config: CompilerContext['configService']['options']
  weappConfig: CompilerContext['configService']['weappViteConfig']
  unchanged: () => boolean
}

/** 在异步加载与独立构建前记录配置所有权，后续不得用新输入身份解释旧输出。 */
export function captureEntryPreparationOwnership(ctx: CompilerContext) {
  const config = ctx.configService.options
  const weappConfig = ctx.configService.weappViteConfig
  const unchanged = capturePreparationInputs(config, weappConfig)
  return unchanged ? { config, weappConfig, unchanged } : undefined
}

/** 只有源码配置对象及其嵌套内容均未改变，准备结果才可交接。 */
export function isEntryPreparationOwnershipCurrent(ctx: CompilerContext, ownership: EntryPreparationOwnership) {
  return ctx.configService.options === ownership.config
    && ctx.configService.weappViteConfig === ownership.weappConfig && ownership.unchanged()
}

// 以插件实例的入口 loader 为 owner，不共享到另一个主构建或独立分包。
const preparations = new WeakMap<object, EntryPreparation>()

/** options 每轮建立新代际，失败或被替换的 options 不能提交旧准备结果。 */
export function beginEntryPreparation(owner: object | undefined) {
  const generation = {}
  if (owner) {
    preparations.set(owner, { generation })
  }
  return generation
}

/** 在解析后续 input 前冻结已准备的身份，不把稍后发生的变化归入旧输出。 */
export function captureEntryPreparation(ctx: CompilerContext, ownership = captureEntryPreparationOwnership(ctx)) {
  const { scan, build } = ctx.runtimeState
  if (!ownership || !isEntryPreparationOwnershipCurrent(ctx, ownership) || !scan.appEntry || scan.isDirty || scan.independentDirtyRoots.size) {
    return
  }
  return {
    runtime: ctx.runtimeState,
    ownership,
    app: scan.appEntry,
    routes: ctx.autoRoutesService?.getSignature(),
    routesDirty: ctx.runtimeState.autoRoutes.dirty,
    routesNeedRescan: ctx.runtimeState.autoRoutes.needsFullRescan,
    pending: build.independent.pendingOutputs,
    roots: [...scan.independentSubPackageMap],
  } satisfies NonNullable<EntryPreparation['snapshot']>
}

/** options 完整成功后才登记本轮交接，失败与被替换的代际不能留下准备结果。 */
export function recordEntryPreparation(owner: object | undefined, generation: object, snapshot: EntryPreparation['snapshot']) {
  const preparation = owner && preparations.get(owner)
  if (preparation?.generation === generation) {
    preparation.snapshot = snapshot
  }
}

/** buildStart 只能消费一次；输入、配置或独立目标在两个阶段间失效时重新准备。 */
export function takeEntryPreparation(owner: object, ctx: CompilerContext) {
  const snapshot = preparations.get(owner)?.snapshot
  preparations.delete(owner)
  if (!snapshot) {
    return
  }
  const { scan, build } = ctx.runtimeState
  if (snapshot.runtime !== ctx.runtimeState
    || !isEntryPreparationOwnershipCurrent(ctx, snapshot.ownership)
    || snapshot.app !== scan.appEntry || scan.isDirty || scan.independentDirtyRoots.size
    || snapshot.routes !== ctx.autoRoutesService?.getSignature()
    || snapshot.routesDirty !== ctx.runtimeState.autoRoutes.dirty
    || snapshot.routesNeedRescan !== ctx.runtimeState.autoRoutes.needsFullRescan
    || snapshot.pending !== build.independent.pendingOutputs
    || snapshot.roots.length !== scan.independentSubPackageMap.size
    || snapshot.roots.some(([root, meta]) => scan.independentSubPackageMap.get(root) !== meta)) {
    return
  }
  return snapshot.app
}

/** buildEnd、关闭与错误退出不能把阶段交接引用留给下一轮 watch 构建。 */
export function clearEntryPreparation(owner: object | undefined) {
  if (owner) {
    preparations.delete(owner)
  }
}
