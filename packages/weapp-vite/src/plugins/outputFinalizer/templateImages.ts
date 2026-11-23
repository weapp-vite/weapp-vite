import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { SubpackageNamingContext } from '../subpackageOutput/ownership'
import type { OutputAssetEntry } from './templates'
import { Buffer } from 'node:buffer'
import { readFile, stat } from 'node:fs/promises'
import path from 'pathe'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { applySourceEdits } from '../../wxml/template/ranges'
import { scanTemplate } from '../../wxml/template/scan'
import { assertReferenceAccess, outputPackage } from '../subpackageOutput/access'

const scripts = new Set(getScriptModuleTagNames('weapp'))

function findLocalImageReferences(code: string, fileName: string) {
  if (!/<image\s/.test(code)) {
    return []
  }
  const { elements } = scanTemplate(code, fileName, scripts, false, 'legacy')
  return elements.flatMap((element) => {
    if (element.tag !== 'image') {
      return []
    }
    const src = element.attrs.find(attr => attr.name === 'src')
    if (!src?.quote) {
      return []
    }
    const value = code.slice(src.valueStart, src.valueEnd)
    if (!value || value.includes('{{') || /^(?:[a-z][\w+.-]*:|\/\/|[?#])/i.test(value)) {
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
    const relative = decoded.startsWith('/')
      ? path.normalize(decoded.slice(1))
      : path.join(path.dirname(fileName), decoded)
    if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith('../')) {
      return []
    }
    return [{ relative, start: src.valueStart, end: src.valueEnd, suffix: suffixStart < 0 ? '' : value.slice(suffixStart) }]
  })
}

/** 将 WXML 的本地静态图片交给 bundler 命名，复用已发射的资源。 */
export function createTemplateImageRewriter(
  bundle: OutputBundle,
  root: string,
  srcRoot: string,
  scope: Pick<SubpackageNamingContext, 'roots' | 'independentRoot'>,
  naming?: {
    publicDir: string | false
    assetsInclude: (file: string) => boolean
    useConsumerPackages: boolean
    emit: (asset: EmittedAsset & { originalFileName: string }, owner: string | undefined) => string
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
  return async (entries: OutputAssetEntry[]) => {
    if (!bySource.size && !naming) {
      return
    }
    const packages = new Map<string, Set<string>>()
    const templates = entries.flatMap(({ bundleFileName, output }) => {
      const fileName = output.fileName || bundleFileName
      const code = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString('utf8')
      const references = findLocalImageReferences(code, fileName).filter(({ relative }) => !outputPaths.has(relative))
      if (!references.length) {
        return []
      }
      if (naming?.useConsumerPackages) {
        const owner = outputPackage(fileName, scope)
        for (const { relative } of references) {
          const owners = packages.get(relative) ?? new Set<string>()
          owners.add(owner)
          packages.set(relative, owners)
        }
      }
      return [{ fileName, code, output, references }]
    })
    const resolvedTargets = new Map<string, Promise<string | null | undefined>>()
    const resolveTarget = async (relative: string) => {
      const original = path.resolve(srcRoot, relative)
      const target = bySource.get(original)
      if (target !== null && naming?.publicDir && (await stat(path.join(naming.publicDir, relative), { throwIfNoEntry: false }))?.isFile()) {
        return null
      }
      if (target !== undefined || !naming?.assetsInclude(original)) {
        return target
      }
      if (!(await stat(original, { throwIfNoEntry: false }))?.isFile()) {
        return null
      }
      const owners = packages.get(relative)
      return naming.emit({
        type: 'asset',
        name: path.basename(original),
        originalFileName: original,
        source: await readFile(original),
      }, owners && (owners.size === 1 ? owners.values().next().value : ''))
    }
    for (const { fileName, code, output, references } of templates) {
      const edits = []
      for (const { relative, start, end, suffix } of references) {
        let pending = resolvedTargets.get(relative)
        if (!pending) {
          pending = resolveTarget(relative)
          resolvedTargets.set(relative, pending)
        }
        const target = await pending
        if (!target) {
          continue
        }
        assertReferenceAccess(fileName, target, scope)
        const encoded = target.split('/').map(segment => encodeURIComponent(segment).replaceAll('\'', '%27')).join('/')
        edits.push({ start, end, text: `/${encoded}${suffix}` })
      }
      if (edits.length) {
        output.source = applySourceEdits(code, edits)
      }
    }
  }
}
