import type { MutableCompilerContext } from '../../context'
import { getCompilerSourceSnapshot, readCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../plugins/utils/vueSfc'
import { hasAppShellTemplate, isAppVueFile } from '../../plugins/vue/transform/appShell'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export interface AppShellSnapshot {
  appId: string
  hasTemplate: boolean
}

async function readAppShellPresence(ctx: MutableCompilerContext, appId: string) {
  if (!ctx.configService) {
    return undefined
  }
  const { descriptor } = await readAndParseSfc(
    appId,
    createReadAndParseSfcOptions(ctx.moduleGraphService, ctx.configService),
  )
  return hasAppShellTemplate({ template: descriptor.template?.content })
}

/** 写出成功后优先提交本代固定输入，首构建沿用实际观测；不重新读取磁盘或借用较新的观测。 */
export async function captureAppShellSnapshot(ctx: MutableCompilerContext, fallbackAppId?: string): Promise<AppShellSnapshot | undefined> {
  const path = ctx.scanService?.appEntry?.path ?? fallbackAppId
  if (!path || !isAppVueFile(path) || ctx.configService?.weappLibConfig?.enabled) {
    return undefined
  }
  const appId = normalizeFsResolvedId(path)
  const source = ctx.configService && readCompilerSourceSnapshot(getCompilerSourceSnapshot(ctx.configService), appId)
  const hasTemplate = source === undefined
    ? ctx.runtimeState.build.hmr.vueEntryHasTemplate.get(appId)
    : await readAppShellPresence(ctx, appId)
  return hasTemplate === undefined ? undefined : { appId, hasTemplate }
}

/** 应用壳有无变化会改变页面脚本能力，必须与页面模板及配置在同一快照重新编译。 */
export async function resolveAppShellSnapshotChange(
  ctx: MutableCompilerContext,
  committed: AppShellSnapshot | undefined,
) {
  if (!committed || !ctx.configService) {
    return undefined
  }
  const hasTemplate = await readAppShellPresence(ctx, committed.appId).catch(() => undefined)
  if (hasTemplate === undefined || hasTemplate === committed.hasTemplate) {
    return undefined
  }
  const pageIds = new Set<string>()
  for (const entry of ctx.runtimeState.build.hmr.entriesMap.values()) {
    if (entry?.type === 'page') {
      pageIds.add(normalizeFsResolvedId(entry.path))
    }
  }
  return { appId: committed.appId, pageIds }
}
