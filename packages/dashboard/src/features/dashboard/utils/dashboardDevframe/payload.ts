import type { DevframeScopedClientRpc } from 'devframe/client'
import type {
  DashboardAnalyzePageRequest,
  DashboardAnalyzePayloadDescriptor,
  DashboardAnalyzePayloadsDescriptor,
  DashboardFileContent,
} from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult } from '../../types'

export interface DashboardAnalyzeSnapshot {
  current: AnalyzeSubpackagesResult
  previous: AnalyzeSubpackagesResult | null
}

export type {
  DashboardAnalyzePage,
  DashboardAnalyzePageRequest,
  DashboardAnalyzePayloadDescriptor,
  DashboardDevframeState,
  DashboardFileContent,
  DashboardFileReadRequest as DashboardFileRequest,
} from 'weapp-vite/dashboard'
export type DashboardFileKind = DashboardFileContent['kind']

const analyzePayloadCache = new Map<string, AnalyzeSubpackagesResult>()
const MAX_CACHED_ANALYZE_PAYLOADS = 2

function isSameDescriptor(
  left: DashboardAnalyzePayloadDescriptor,
  right: DashboardAnalyzePayloadDescriptor,
) {
  return left.characters === right.characters
    && left.hash === right.hash
    && left.pages === right.pages
}

function cacheAnalyzePayload(descriptor: DashboardAnalyzePayloadDescriptor, result: AnalyzeSubpackagesResult) {
  analyzePayloadCache.delete(descriptor.hash)
  analyzePayloadCache.set(descriptor.hash, result)
  while (analyzePayloadCache.size > MAX_CACHED_ANALYZE_PAYLOADS) {
    const oldest = analyzePayloadCache.keys().next().value
    if (typeof oldest !== 'string') {
      break
    }
    analyzePayloadCache.delete(oldest)
  }
}

function parseAnalyzePayload(value: string) {
  const result = JSON.parse(value) as AnalyzeSubpackagesResult
  if (!Array.isArray(result?.packages) || !Array.isArray(result.modules) || !Array.isArray(result.subPackages)) {
    throw new TypeError('Devframe 返回了无效的 Analyze 数据。')
  }
  return result
}

async function readAnalyzePayload(
  rpc: DevframeScopedClientRpc<'weapp-vite'>,
  descriptor: DashboardAnalyzePayloadDescriptor,
  target: DashboardAnalyzePageRequest['target'],
  revision: number,
) {
  const cached = analyzePayloadCache.get(descriptor.hash)
  if (cached) {
    cacheAnalyzePayload(descriptor, cached)
    return cached
  }

  const pages: string[] = []
  let characters = 0
  for (let index = 0; index < descriptor.pages; index++) {
    const page = await rpc.call('get-analyze-page', { index, revision, target })
    if (
      page.index !== index
      || page.revision !== revision
      || page.target !== target
      || !isSameDescriptor(page.descriptor, descriptor)
    ) {
      throw new Error('Devframe 返回了不一致的 Analyze 分页。')
    }
    pages.push(page.content)
    characters += page.content.length
  }
  if (characters !== descriptor.characters) {
    throw new Error('Devframe 返回了不完整的 Analyze 分页。')
  }

  const result = parseAnalyzePayload(pages.join(''))
  cacheAnalyzePayload(descriptor, result)
  return result
}

export async function readDashboardAnalyzeSnapshot(
  rpc: DevframeScopedClientRpc<'weapp-vite'>,
  descriptors: DashboardAnalyzePayloadsDescriptor,
  revision: number,
): Promise<DashboardAnalyzeSnapshot> {
  const previous = descriptors.previous
    ? await readAnalyzePayload(rpc, descriptors.previous, 'previous', revision)
    : null
  const current = await readAnalyzePayload(rpc, descriptors.current, 'current', revision)
  return { current, previous }
}
