import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { SubpackageNamingContext } from '../subpackageOutput/ownership'
import type { OutputAssetEntry } from './templates'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'pathe'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { applySourceEdits } from '../../wxml/template/ranges'
import { scanTemplate } from '../../wxml/template/scan'
import { assertReferenceAccess, outputPackage } from '../subpackageOutput/access'

const scripts = new Set(getScriptModuleTagNames('weapp'))

export type TemplateImageSources = Map<string, Set<string>>

export function findLocalImageReferences(code: string, fileName: string) {
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
    if (!relative || path.isAbsolute(relative)) {
      return []
    }
    return [{ relative, absoluteUrl: decoded.startsWith('/'), start: src.valueStart, end: src.valueEnd, suffix: suffixStart < 0 ? '' : value.slice(suffixStart) }]
  })
}

type ImageReference = ReturnType<typeof findLocalImageReferences>[number]

/** 模板路径相对源码目录；允许显式引用项目依赖目录，其他目录越界路径不参与资源构建。 */
async function resolveTemplateImageSource(
  { relative, absoluteUrl }: ImageReference,
  root: string,
  srcRoot: string,
  publicDir: string | false,
) {
  const escapesSource = relative === '..' || relative.startsWith('../')
  const source = path.resolve(srcRoot, relative)
  if (escapesSource) {
    return !absoluteUrl && path.relative(root, source).startsWith('node_modules/') ? source : undefined
  }
  if (publicDir && (await stat(path.join(publicDir, relative), { throwIfNoEntry: false }))?.isFile()) {
    return undefined
  }
  if (absoluteUrl && relative.startsWith('node_modules/') && !(await stat(source, { throwIfNoEntry: false }))?.isFile()) {
    return path.resolve(root, relative)
  }
  return source
}

export function createTemplateImageSourceResolver(root: string, srcRoot: string, publicDir: string | false) {
  const requests = new Map<string, Promise<string | undefined>>()
  return (reference: ImageReference) => {
    const key = `${reference.absoluteUrl ? '/' : ''}${reference.relative}`
    let request = requests.get(key)
    if (!request) {
      request = resolveTemplateImageSource(reference, root, srcRoot, publicDir)
      requests.set(key, request)
    }
    return request
  }
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
    onRewrite?: (source: string, target: string) => void
    emit: (asset: EmittedAsset & { originalFileName: string }, owner: string | undefined) => string
  },
) {
  const bySource = new Map<string, string | null>()
  const outputs = new Map<string, Extract<OutputBundle[string], { type: 'asset' }>>()
  for (const output of Object.values(bundle)) {
    if (output.type !== 'asset') {
      continue
    }
    outputs.set(output.fileName, output)
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
    const resolveSource = createTemplateImageSourceResolver(root, srcRoot, naming?.publicDir ?? false)
    const templates = (await Promise.all(entries.map(async ({ bundleFileName, output }) => {
      const fileName = output.fileName || bundleFileName
      const code = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString('utf8')
      const references = []
      for (const reference of findLocalImageReferences(code, fileName)) {
        const { relative } = reference
        const existing = outputs.get(relative)
        if (existing) {
          // 已匹配产物的路径无需改写，但显式命名仍可能把它放到不可访问的包内。
          if (naming && existing.originalFileNames?.length) {
            assertReferenceAccess(fileName, relative, scope)
          }
          continue
        }
        const source = await resolveSource(reference)
        if (source) {
          references.push({ ...reference, source })
        }
      }
      if (!references.length) {
        return []
      }
      return [{ fileName, code, output, references }]
    }))).flat()
    const loadTarget = async (original: string) => {
      const target = bySource.get(original)
      if (target !== undefined || !naming?.assetsInclude(original)) {
        return target
      }
      if (!(await stat(original, { throwIfNoEntry: false }))?.isFile()) {
        return null
      }
      return {
        type: 'asset' as const,
        name: path.basename(original),
        originalFileName: original,
        source: await readFile(original),
      }
    }
    const imageKeys = new Map<string, string>()
    const ownersByContent = new Map<string, Set<string>>()
    const loads = new Map<string, Promise<Awaited<ReturnType<typeof loadTarget>>>>()
    if (naming?.useConsumerPackages) {
      const packages = new Map<string, Set<string>>()
      for (const { fileName, references } of templates) {
        const owner = outputPackage(fileName, scope)
        for (const { source } of references) {
          const owners = packages.get(source) ?? new Set<string>()
          owners.add(owner)
          packages.set(source, owners)
        }
      }
      // Rolldown 在首次发射相同字节时决定名称；同内容图片需要先合并全部模板消费者。
      for (const source of packages.keys()) {
        loads.set(source, loadTarget(source))
      }
      for (const [source, target] of await Promise.all([...loads].map(async ([source, load]) => [source, await load] as const))) {
        if (!target || typeof target === 'string') {
          continue
        }
        const key = createHash('sha256').update(target.source).digest('hex')
        imageKeys.set(source, key)
        const owners = ownersByContent.get(key) ?? new Set<string>()
        for (const owner of packages.get(source)!) {
          owners.add(owner)
        }
        ownersByContent.set(key, owners)
      }
    }
    const resolveTarget = async (source: string) => {
      const target = await (loads.get(source) ?? loadTarget(source))
      if (!target || typeof target === 'string') {
        return target
      }
      const key = imageKeys.get(source)
      const owners = key === undefined ? undefined : ownersByContent.get(key)
      return naming!.emit(target, owners && (owners.size === 1 ? owners.values().next().value : ''))
    }
    const resolvedTargets = new Map<string, Promise<string | null | undefined>>()
    for (const { fileName, code, output, references } of templates) {
      const edits = []
      for (const { source, start, end, suffix } of references) {
        let pending = resolvedTargets.get(source)
        if (!pending) {
          pending = resolveTarget(source)
          resolvedTargets.set(source, pending)
        }
        const target = await pending
        if (!target) {
          continue
        }
        assertReferenceAccess(fileName, target, scope)
        naming?.onRewrite?.(source, target)
        const encoded = target.split('/').map(segment => encodeURIComponent(segment).replaceAll('\'', '%27')).join('/')
        edits.push({ start, end, text: `/${encoded}${suffix}` })
      }
      if (edits.length) {
        output.source = applySourceEdits(code, edits)
      }
    }
  }
}
