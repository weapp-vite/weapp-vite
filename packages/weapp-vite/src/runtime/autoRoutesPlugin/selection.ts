import type { MutableCompilerContext } from '../../context'
import type { CandidateEntry } from './candidates'
import { removeExtensionDeep } from '@weapp-core/shared'
import { scriptExtensions, vueExtensions } from '../../constants'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { isConfigFile, isScriptFile, isVueFile } from './candidates'

const PAGE_SOURCE_EXTENSIONS = [...scriptExtensions, ...vueExtensions]

/** 扫描和构建共享源文件优先级；配置数组仅过滤，不改变优先级。 */
export function selectPageSources(candidate: CandidateEntry, extensions?: readonly string[]) {
  return PAGE_SOURCE_EXTENSIONS
    .filter(extension => !extensions?.length || extensions.includes(extension))
    .map(extension => `${candidate.base}.${extension}`)
    .filter(source => candidate.files.has(source))
}

/** 保留配套资源，只从页面入口候选中排除未允许的脚本。 */
export function selectRouteCandidate(candidate: CandidateEntry, extensions?: readonly string[]): CandidateEntry | undefined {
  if (!extensions?.length) {
    return candidate
  }
  if (![...candidate.files].some(file => extensions.includes(file.slice(candidate.base.length + 1)))) {
    return undefined
  }
  const sources = selectPageSources(candidate, extensions)
  const files = new Set([...candidate.files].filter(file => isConfigFile(file)
    || (!isScriptFile(file) && !isVueFile(file)) || sources.includes(file)))
  return { ...candidate, files, hasScript: sources.length > 0 }
}

/** 仅解析自动路由的物理入口；显式业务 import 不经过此入口。 */
export function getSelectedAutoRouteSource(ctx: MutableCompilerContext, id: string) {
  const config = ctx.configService?.weappViteConfig?.autoRoutes
  if (!config || typeof config !== 'object' || config.enabled === false || !config.extensions?.length) {
    return undefined
  }
  const base = removeExtensionDeep(normalizeFsResolvedId(id))
  return PAGE_SOURCE_EXTENSIONS.map(extension => `${base}.${extension}`)
    .find(source => ctx.runtimeState.autoRoutes.pageSourceFiles.has(source))
}
