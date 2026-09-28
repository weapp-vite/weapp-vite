import type { HmrCompilerPreparation } from './types'
import remapping from '@jridgewell/remapping'

export interface HmrSourceMap {
  version: number
  sources: string[]
  names: string[]
  mappings: string
  sourcesContent?: Array<string | null>
  file?: string
  sourceRoot?: string
}

export interface HmrUpdate {
  type: string
  code?: string
  filename?: string
  sourcemap?: string
}

export interface HmrClientUpdate<U extends HmrUpdate = HmrUpdate> {
  clientId: string
  update: U
}

export interface HmrBatch<U extends HmrClientUpdate = HmrClientUpdate> {
  changedFiles: readonly string[]
  updates: readonly U[]
}

export type CapturedHmrBatch<B extends HmrBatch> = Readonly<Omit<B, 'changedFiles' | 'updates'>> & HmrBatch<B['updates'][number] & HmrClientUpdate>

type TransformedUpdate<U extends HmrUpdate> = U extends HmrUpdate
  ? Omit<U, 'code' | 'sourcemap'> & Pick<HmrUpdate, 'sourcemap'> & (U extends { code: string } ? { code: string } : Pick<HmrUpdate, 'code'>)
  : never

type TransformedClient<U extends HmrClientUpdate> = U extends HmrClientUpdate
  ? Omit<U, 'update'> & { update: TransformedUpdate<U['update']> }
  : never

export type TransformedHmrBatch<B extends HmrBatch> = Readonly<Omit<B, 'changedFiles' | 'updates'>> & HmrBatch<TransformedClient<B['updates'][number]>>

/** 在回调入口保留完整元数据和原始顺序，不合并不同的源码代次。 */
export function captureHmrBatch<B extends HmrBatch>(batch: B): CapturedHmrBatch<B> {
  const snapshot = structuredClone(batch)
  return Object.freeze({
    ...snapshot,
    changedFiles: Object.freeze([...snapshot.changedFiles]),
    updates: Object.freeze(snapshot.updates.map(item => Object.freeze({ ...item, update: Object.freeze({ ...item.update }) }))),
  })
}

export function normalizeHmrSourceMap(value: unknown): HmrSourceMap | null {
  if (typeof value === 'string') {
    return normalizeHmrSourceMap(JSON.parse(value))
  }
  if (!value || typeof value !== 'object') {
    return null
  }
  if ('version' in value && Number(value.version) === 3 && 'sources' in value && Array.isArray(value.sources)
    && value.sources.every(source => typeof source === 'string') && 'names' in value && Array.isArray(value.names)
    && value.names.every(name => typeof name === 'string') && 'mappings' in value && typeof value.mappings === 'string') {
    // Rolldown 的 native map 字段可能是不可枚举 getter，展开对象会丢失有效映射。
    const map: HmrSourceMap = {
      version: 3,
      sources: [...value.sources],
      names: [...value.names],
      mappings: value.mappings,
    }
    if ('file' in value && typeof value.file === 'string') {
      map.file = value.file
    }
    if ('sourceRoot' in value && typeof value.sourceRoot === 'string') {
      map.sourceRoot = value.sourceRoot
    }
    if ('sourcesContent' in value && Array.isArray(value.sourcesContent)) {
      if (!value.sourcesContent.every(source => source == null || typeof source === 'string')) {
        throw new TypeError('Invalid HMR source contents')
      }
      map.sourcesContent = value.sourcesContent.map(source => source ?? null)
    }
    return map
  }
  throw new TypeError('Invalid HMR source map')
}

/** 每份补丁单独组合映射，同名 filename 的连续版本仍保持独立。 */
export function composeHmrSourceMaps(next: HmrSourceMap | null, previous: HmrSourceMap | null): HmrSourceMap | null {
  if (!next) {
    return previous
  }
  if (!previous?.sources.length || !previous.mappings) {
    return next
  }
  return normalizeHmrSourceMap(remapping([{ ...next, version: 3 }, { ...previous, version: 3 }], () => null))
}

export async function transformHmrPatch(
  patch: { code: string, filename: string, sourcemap?: string },
  preparations: readonly HmrCompilerPreparation[],
  sourcemap: boolean,
): Promise<{ code: string, map: HmrSourceMap | null }> {
  let code = patch.code.replace(/^\/\/[#@] sourceMappingURL=.*$/gm, '')
  let map = sourcemap && patch.sourcemap ? normalizeHmrSourceMap(patch.sourcemap) : null
  if (map && (!map.sources.length || !map.mappings)) {
    map = null
  }
  for (const preparation of preparations) {
    const result = await preparation.transformJavaScript?.({ code, fileName: patch.filename, sourcemap })
    if (result) {
      if (sourcemap && result.code !== code && !result.map) {
        throw new Error('Compiler HMR transform changed code without a source map')
      }
      if (sourcemap) {
        map = composeHmrSourceMaps(normalizeHmrSourceMap(result.map), map)
      }
      code = result.code
    }
  }
  return { code, map }
}

/** 只拓宽会被转换的字段；其余宿主元数据保持原类型。 */
function withPatchTransform<U extends HmrClientUpdate>(item: U, update?: Pick<HmrUpdate, 'code' | 'sourcemap'>): TransformedClient<U>
function withPatchTransform(item: HmrClientUpdate, update?: Pick<HmrUpdate, 'code' | 'sourcemap'>): HmrClientUpdate {
  return update ? { ...item, update: { ...item.update, ...update } } : item
}

/** 只转换 Patch 的代码和映射；宿主继续决定 FullReload、Noop 和每个 client 的处理。 */
export async function transformHmrBatch<B extends HmrBatch>(
  batch: B,
  preparations: readonly HmrCompilerPreparation[],
  options: { sourcemap: boolean },
): Promise<TransformedHmrBatch<B>> {
  const captured = captureHmrBatch(batch)
  const updates: TransformedClient<B['updates'][number]>[] = []
  for (const item of captured.updates) {
    const patch = item.update
    if (patch.type !== 'Patch' || typeof patch.code !== 'string' || typeof patch.filename !== 'string') {
      updates.push(withPatchTransform<B['updates'][number]>(item))
      continue
    }
    const transformed = await transformHmrPatch({ ...patch, code: patch.code, filename: patch.filename }, preparations, options.sourcemap)
    updates.push(withPatchTransform<B['updates'][number]>(item, { code: transformed.code, sourcemap: transformed.map ? JSON.stringify(transformed.map) : undefined }))
  }
  return { ...captured, updates }
}
