import type { AnalyzeSubpackagesResult } from '../analyze/subpackages'
import type { DashboardAnalyzeSnapshot } from './index'
import { createHash } from 'node:crypto'
import { dashboardAnalyzePageRequestSchema } from './schema'

export const MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS = 64 * 1024
export const STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE = 'Analyze revision 已变化，请重新获取 Dashboard 状态。'

export interface DashboardAnalyzePayloadDescriptor {
  characters: number
  hash: string
  pages: number
}

export interface DashboardAnalyzePayloadsDescriptor {
  current: DashboardAnalyzePayloadDescriptor
  previous: DashboardAnalyzePayloadDescriptor | null
}

export interface DashboardAnalyzePageRequest {
  index: number
  revision: number
  target: 'current' | 'previous'
}

export interface DashboardAnalyzePage {
  content: string
  descriptor: DashboardAnalyzePayloadDescriptor
  index: number
  revision: number
  target: DashboardAnalyzePageRequest['target']
}

interface SerializedDashboardAnalyzePayload {
  descriptor: DashboardAnalyzePayloadDescriptor
  source: AnalyzeSubpackagesResult
  value: string
}

export interface SerializedDashboardAnalyzeSnapshot {
  current: SerializedDashboardAnalyzePayload
  previous: SerializedDashboardAnalyzePayload | null
}

function serializeDashboardAnalyzePayload(result: AnalyzeSubpackagesResult): SerializedDashboardAnalyzePayload {
  const value = JSON.stringify(result)
  return {
    descriptor: {
      characters: value.length,
      hash: createHash('sha256').update(value).digest('hex'),
      pages: Math.max(1, Math.ceil(value.length / MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS)),
    },
    source: result,
    value,
  }
}

export function serializeDashboardAnalyzeSnapshot(
  snapshot: DashboardAnalyzeSnapshot,
  cached?: SerializedDashboardAnalyzeSnapshot,
): SerializedDashboardAnalyzeSnapshot {
  const previous = snapshot.previous
    ? cached?.current.source === snapshot.previous
      ? cached.current
      : cached?.previous?.source === snapshot.previous
        ? cached.previous
        : serializeDashboardAnalyzePayload(snapshot.previous)
    : null
  return {
    current: cached?.current.source === snapshot.current
      ? cached.current
      : serializeDashboardAnalyzePayload(snapshot.current),
    previous,
  }
}

export function readDashboardAnalyzePage(
  input: unknown,
  revision: number,
  snapshot: SerializedDashboardAnalyzeSnapshot,
): DashboardAnalyzePage {
  const request = dashboardAnalyzePageRequestSchema.parse(input)
  if (request.revision !== revision) {
    throw new Error(STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE)
  }
  const payload = request.target === 'current' ? snapshot.current : snapshot.previous
  if (!payload || request.index >= payload.descriptor.pages) {
    throw new Error('Analyze 分页不存在。')
  }
  const start = request.index * MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS
  return {
    content: payload.value.slice(start, start + MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS),
    descriptor: payload.descriptor,
    index: request.index,
    revision,
    target: request.target,
  }
}
