import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { SubpackageNamingContext } from '../subpackageOutput/ownership'
import { readFile, stat } from 'node:fs/promises'
import path from 'pathe'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { applySourceEdits } from '../../wxml/template/ranges'
import { scanTemplate } from '../../wxml/template/scan'
import { assertReferenceAccess } from '../subpackageOutput/access'

/** 将 WXML 的本地静态图片交给 bundler 命名，复用已发射的资源。 */
export function createTemplateImageRewriter(
  bundle: OutputBundle,
  root: string,
  srcRoot: string,
  scope: Pick<SubpackageNamingContext, 'roots' | 'independentRoot'>,
  naming?: {
    publicDir: string | false
    assetsInclude: (file: string) => boolean
    emit: (asset: EmittedAsset & { originalFileName: string }) => string
  },
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
  return async (code: string, fileName: string) => {
    if ((!bySource.size && !naming) || !/<image\s/.test(code)) {
      return code
    }
    const { elements } = scanTemplate(code, fileName, scripts, false, 'legacy')
    const edits = []
    for (const element of elements) {
      if (element.tag !== 'image') {
        continue
      }
      const src = element.attrs.find(attr => attr.name === 'src')
      if (!src?.quote) {
        continue
      }
      const value = code.slice(src.valueStart, src.valueEnd)
      if (!value || value.includes('{{') || /^(?:[a-z][\w+.-]*:|\/\/|[?#])/i.test(value)) {
        continue
      }
      const suffixStart = value.search(/[?#]/)
      const pathname = suffixStart < 0 ? value : value.slice(0, suffixStart)
      let decoded: string
      try {
        decoded = decodeURIComponent(pathname)
      }
      catch {
        continue
      }
      const relative = decoded.startsWith('/')
        ? path.normalize(decoded.slice(1))
        : path.join(path.dirname(fileName), decoded)
      if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith('../') || outputPaths.has(relative)) {
        continue
      }
      const original = path.resolve(srcRoot, relative)
      if (naming?.publicDir && (await stat(path.join(naming.publicDir, relative), { throwIfNoEntry: false }))?.isFile()) {
        continue
      }
      let target = bySource.get(original)
      if (target === undefined && naming?.assetsInclude(original)) {
        if (!(await stat(original, { throwIfNoEntry: false }))?.isFile()) {
          bySource.set(original, null)
          continue
        }
        target = naming.emit({
          type: 'asset',
          name: path.basename(original),
          originalFileName: original,
          source: await readFile(original),
        })
        bySource.set(original, target)
      }
      if (!target) {
        continue
      }
      assertReferenceAccess(fileName, target, scope)
      const encoded = target.split('/').map(segment => encodeURIComponent(segment).replaceAll('\'', '%27')).join('/')
      edits.push({ start: src.valueStart, end: src.valueEnd, text: `/${encoded}${suffixStart < 0 ? '' : value.slice(suffixStart)}` })
    }
    return applySourceEdits(code, edits)
  }
}
