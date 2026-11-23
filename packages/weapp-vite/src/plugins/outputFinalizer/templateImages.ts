import type { OutputBundle } from 'rolldown'
import type { SubpackageNamingContext } from '../subpackageOutput/ownership'
import path from 'pathe'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { applySourceEdits } from '../../wxml/template/ranges'
import { scanTemplate } from '../../wxml/template/scan'
import { assertReferenceAccess } from '../subpackageOutput/access'

/** 让 WXML 引用已由 bundler 发射的图片，保留独立复制的图片和运行时绑定。 */
export function createTemplateImageRewriter(
  bundle: OutputBundle,
  root: string,
  srcRoot: string,
  scope: Pick<SubpackageNamingContext, 'roots' | 'independentRoot'>,
) {
  const bySource = new Map<string, string | null>()
  const outputPaths = new Set<string>()
  for (const output of Object.values(bundle)) {
    if (output.type !== 'asset') {
      continue
    }
    outputPaths.add(output.fileName)
    for (const original of output.originalFileNames ?? []) {
      const source = path.resolve(root, original)
      const previous = bySource.get(source)
      bySource.set(source, previous === undefined || previous === output.fileName ? output.fileName : null)
    }
  }
  const scripts = new Set(getScriptModuleTagNames('weapp'))
  return (code: string, fileName: string) => {
    if (!bySource.size || !/<image\s/.test(code)) {
      return code
    }
    const { elements } = scanTemplate(code, fileName, scripts, false, 'legacy')
    return applySourceEdits(code, elements.flatMap((element) => {
      if (element.tag !== 'image') {
        return []
      }
      const src = element.attrs.find(attr => attr.name === 'src')
      if (!src?.quote) {
        return []
      }
      const value = code.slice(src.valueStart, src.valueEnd)
      if (!value || value.includes('{{') || /^(?:[a-z][\w+.-]*:|[/?#])/i.test(value)) {
        return []
      }
      const suffixStart = value.search(/[?#]/)
      const pathname = suffixStart < 0 ? value : value.slice(0, suffixStart)
      let decoded: string
      try {
        decoded = decodeURIComponent(pathname)
      }
      catch {
        return []
      }
      const relative = path.join(path.dirname(fileName), decoded)
      if (path.isAbsolute(decoded) || relative === '..' || relative.startsWith('../') || outputPaths.has(relative)) {
        return []
      }
      const target = bySource.get(path.resolve(srcRoot, relative))
      if (!target) {
        return []
      }
      assertReferenceAccess(fileName, target, scope)
      const encoded = target.split('/').map(segment => encodeURIComponent(segment).replaceAll('\'', '%27')).join('/')
      return [{ start: src.valueStart, end: src.valueEnd, text: `/${encoded}${suffixStart < 0 ? '' : value.slice(suffixStart)}` }]
    }))
  }
}
