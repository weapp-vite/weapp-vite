import type { ScanWxmlOptions } from '../../types'
import type { ResolveSfcBlockSrcOptions } from './vueSfc'
import MagicString from 'magic-string'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { scanWxml } from '../../wxml'

const resolutionsByOptions = new WeakMap<ResolveSfcBlockSrcOptions, Map<string, string>>()

/** 记录本次 src 解析实际选中的文件，不推测 block 类型或文件扩展名。 */
export function recordSfcBlockSource(options: ResolveSfcBlockSrcOptions, source: string, importer: string, resolvedId?: string) {
  let resolutions = resolutionsByOptions.get(options)
  if (!resolutions) {
    resolutions = new Map()
    resolutionsByOptions.set(options, resolutions)
  }
  const normalized = normalizeFsResolvedId(resolvedId ?? source)
  resolutions.set(`${importer}\0${source}`, path.isAbsolute(normalized) ? normalized : path.resolve(path.dirname(importer), normalized))
}

/** 使用 descriptor 或编译器 manifest 的模板身份获取真实 src 文件。 */
export function resolveSfcTemplateSource(options: ResolveSfcBlockSrcOptions | undefined, source: string | undefined, importer: string) {
  return options && source ? resolutionsByOptions.get(options)?.get(`${importer}\0${source}`) : undefined
}

/** 外部模板编入 SFC 输出后，原生 import/include/WXS 仍指向其原始文件。 */
export function rebaseSfcTemplateDependencies(template: string, source: string | undefined, owner: string, platform?: ScanWxmlOptions['platform'], preserveScriptModules?: ReadonlySet<string>) {
  if (!source || path.dirname(source) === path.dirname(owner)) {
    return template
  }
  const token = scanWxml(template, { platform })
  const rewritten = new MagicString(template)
  for (const dependency of token.deps) {
    const value = dependency.value
    const compilerOwnedScript = (dependency.tagName === 'wxs' || dependency.tagName === 'sjs') && preserveScriptModules?.has(dependency.attrs.module)
    if (!value || value.startsWith('/') || value.includes('://') || value.includes('{{') || compilerOwnedScript) {
      continue
    }
    const resolved = path.resolve(path.dirname(source), value)
    const relative = path.relative(path.dirname(owner), resolved)
    const rebased = relative.startsWith('.') ? relative : `./${relative}`
    rewritten.overwrite(dependency.start, dependency.end, `${dependency.name}=${JSON.stringify(rebased)}`)
  }
  return rewritten.toString()
}
