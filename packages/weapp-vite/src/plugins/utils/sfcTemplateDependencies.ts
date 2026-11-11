import type { CompilerContext } from '../../context'
import type { ScanWxmlOptions, WxmlDep } from '../../types'
import type { ResolveSfcBlockSrcOptions } from './vueSfc'
import { LRUCache } from 'lru-cache'
import MagicString from 'magic-string'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { scanWxml } from '../../wxml'

const resolutionsByOptions = new WeakMap<ResolveSfcBlockSrcOptions, Map<string, string>>()
const resolutionsByConfig = new WeakMap<object, LRUCache<string, string>>()

function sourceKey(source: string, importer: string) {
  return `${normalizeFsResolvedId(importer)}\0${source}`
}

/** 记录本次 src 解析实际选中的文件，不推测 block 类型或文件扩展名。 */
export function recordSfcBlockSource(options: ResolveSfcBlockSrcOptions, source: string, importer: string, resolvedId?: string, configService?: CompilerContext['configService']) {
  let resolutions = resolutionsByOptions.get(options)
  if (!resolutions) {
    resolutions = new Map()
    resolutionsByOptions.set(options, resolutions)
  }
  const normalized = normalizeFsResolvedId(resolvedId ?? source)
  const resolved = path.isAbsolute(normalized) ? normalized : path.resolve(path.dirname(importer), normalized)
  resolutions.set(sourceKey(source, importer), resolved)
  if (configService) {
    // 配置重载替换 options 身份；跨构建只保留有界路径事实，不保存 resolver 或钩子上下文。
    const owner = configService.options ?? configService
    let recorded = resolutionsByConfig.get(owner)
    // 旧模板重定位允许相对兜底；未解析的 alias 不等于编译器已确认的文件身份。
    if (!resolvedId && !path.isAbsolute(source) && !source.startsWith('./') && !source.startsWith('../')) {
      recorded?.delete(sourceKey(source, importer))
      return
    }
    if (!recorded) {
      recorded = new LRUCache({ max: 2048 })
      resolutionsByConfig.set(owner, recorded)
    }
    recorded.set(sourceKey(source, importer), resolved)
  }
}

/** snapshot 只查询合法钩子已选定的外部块身份；缺失事实由调用方保守处理。 */
export function getRecordedSfcBlockSource(configService: CompilerContext['configService'], source: string, importer: string) {
  return configService && resolutionsByConfig.get(configService.options ?? configService)?.get(sourceKey(source, importer))
}

/** 使用 descriptor 或编译器 manifest 的模板身份获取真实 src 文件。 */
export function resolveSfcTemplateSource(options: ResolveSfcBlockSrcOptions | undefined, source: string | undefined, importer: string) {
  return options && source ? resolutionsByOptions.get(options)?.get(sourceKey(source, importer)) : undefined
}

/** 原始 Vue 模板与编译后模板共用外部依赖的路径定位规则。 */
export function rebaseSfcTemplateDependency(dependency: WxmlDep, source: string | undefined, owner: string, preserveScriptModules?: ReadonlySet<string>) {
  const value = dependency.value
  const compilerOwnedScript = (dependency.tagName === 'wxs' || dependency.tagName === 'sjs') && preserveScriptModules?.has(dependency.attrs.module)
  if (!source || path.dirname(source) === path.dirname(owner) || !value || value.startsWith('/') || value.includes('://') || value.includes('{{') || compilerOwnedScript) {
    return dependency
  }
  const resolved = path.resolve(path.dirname(source), value)
  const relative = path.relative(path.dirname(owner), resolved)
  return { ...dependency, value: relative.startsWith('.') ? relative : `./${relative}` }
}

/** 外部模板编入 SFC 输出后，原生 import/include/WXS 仍指向其原始文件。 */
export function rebaseSfcTemplateDependencies(template: string, source: string | undefined, owner: string, platform?: ScanWxmlOptions['platform'], preserveScriptModules?: ReadonlySet<string>) {
  if (!source || path.dirname(source) === path.dirname(owner)) {
    return template
  }
  const token = scanWxml(template, { platform })
  const rewritten = new MagicString(template)
  for (const dependency of token.deps) {
    const rebased = rebaseSfcTemplateDependency(dependency, source, owner, preserveScriptModules)
    if (rebased !== dependency) {
      rewritten.overwrite(dependency.start, dependency.end, `${dependency.name}=${JSON.stringify(rebased.value)}`)
    }
  }
  return rewritten.toString()
}
