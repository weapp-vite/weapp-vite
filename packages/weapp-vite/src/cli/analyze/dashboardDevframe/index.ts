import type { DevframeDefinition } from 'devframe'
import type { AnalyzeSubpackagesResult } from '../../../analyze/subpackages'
import type {
  DashboardContentRoots,
  DashboardFileContent,
  DashboardFileKind,
} from './content'
import { createHash } from 'node:crypto'
import { defineDevframe, defineRpcFunction } from 'devframe'
import { VERSION } from '../../../constants'
import {
  createDashboardFileReader,
  MAX_DASHBOARD_FILE_CONTENT_BYTES,
  readDashboardFileContent,
} from './content'

const DEVFRAME_ID = 'weapp-vite'
export const MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS = 64 * 1024
const STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE = 'Analyze revision 已变化，请重新获取 Dashboard 状态。'

const rejectDashboardSharedStateSet = defineRpcFunction({
  name: 'devframe:rpc:server-state:set',
  type: 'action',
  handler: (): void => {
    throw new Error('Dashboard Devframe shared state 只允许服务端修改。')
  },
})
const rejectDashboardSharedStatePatch = defineRpcFunction({
  name: 'devframe:rpc:server-state:patch',
  type: 'action',
  handler: (): void => {
    throw new Error('Dashboard Devframe shared state 只允许服务端修改。')
  },
})

export interface DashboardAnalyzeSnapshot {
  current: AnalyzeSubpackagesResult
  previous: AnalyzeSubpackagesResult | null
}

export interface DashboardAnalyzePayloadDescriptor {
  characters: number
  hash: string
  pages: number
}

export interface DashboardAnalyzePayloadsDescriptor {
  current: DashboardAnalyzePayloadDescriptor
  previous: DashboardAnalyzePayloadDescriptor | null
}

export interface DashboardDevframeState {
  analyze: DashboardAnalyzePayloadsDescriptor
  revision: number
  runtimeEvents: unknown[]
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

interface SerializedDashboardAnalyzeSnapshot {
  current: SerializedDashboardAnalyzePayload
  previous: SerializedDashboardAnalyzePayload | null
}

interface CreateDashboardDevframeOptions {
  getAnalyzeSnapshot: () => DashboardAnalyzeSnapshot
  getRuntimeEvents: () => unknown[]
  roots: DashboardContentRoots
}

export interface AnalyzeDashboardDevframeController {
  definition: DevframeDefinition
  notifyAnalyzeUpdate: () => void
  syncRuntimeEvents: () => void
}

declare module 'devframe' {
  interface DevframeRpcClientFunctions {
    'weapp-vite:dashboard-state-updated': (state: DashboardDevframeState) => void
  }

  interface DevframeRpcServerFunctions {
    'weapp-vite:get-dashboard-state': () => DashboardDevframeState
    'weapp-vite:get-analyze-page': (input: DashboardAnalyzePageRequest) => DashboardAnalyzePage
    'weapp-vite:read-dashboard-file': (input: { kind: DashboardFileKind, path: string }) => Promise<DashboardFileContent>
  }
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

function serializeDashboardAnalyzeSnapshot(
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

function createDashboardState(
  revision: number,
  snapshot: SerializedDashboardAnalyzeSnapshot,
  runtimeEvents: unknown[],
): DashboardDevframeState {
  return {
    analyze: {
      current: snapshot.current.descriptor,
      previous: snapshot.previous?.descriptor ?? null,
    },
    revision,
    runtimeEvents: [...runtimeEvents],
  }
}

function normalizeAnalyzePageRequest(input: unknown): DashboardAnalyzePageRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('必须传入合法的 Analyze 分页请求。')
  }
  if (!('revision' in input) || !('target' in input) || !('index' in input)) {
    throw new Error('必须传入合法的 Analyze 分页请求。')
  }
  const revision = input.revision
  const target = input.target
  const index = input.index
  if (
    typeof revision !== 'number'
    || !Number.isSafeInteger(revision)
    || revision < 0
    || (target !== 'current' && target !== 'previous')
    || typeof index !== 'number'
    || !Number.isSafeInteger(index)
    || index < 0
  ) {
    throw new Error('必须传入合法的 Analyze 分页请求。')
  }
  return { revision, target, index }
}

function readDashboardAnalyzePage(
  input: unknown,
  revision: number,
  snapshot: SerializedDashboardAnalyzeSnapshot,
): DashboardAnalyzePage {
  const request = normalizeAnalyzePageRequest(input)
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

export function createAnalyzeDashboardDevframe(
  options: CreateDashboardDevframeOptions,
): AnalyzeDashboardDevframeController {
  let revision = 0
  let serializedSnapshot = serializeDashboardAnalyzeSnapshot(options.getAnalyzeSnapshot())
  let broadcastDashboardState: (() => Promise<void>) | undefined
  const fileReader = createDashboardFileReader(options.roots, options.getAnalyzeSnapshot().current)

  const getDashboardState = defineRpcFunction({
    name: 'get-dashboard-state',
    type: 'query',
    jsonSerializable: true,
    handler: () => createDashboardState(revision, serializedSnapshot, options.getRuntimeEvents()),
  })
  const getAnalyzePage = defineRpcFunction({
    name: 'get-analyze-page',
    type: 'query',
    jsonSerializable: true,
    handler: (input: unknown) => readDashboardAnalyzePage(input, revision, serializedSnapshot),
  })
  const readDashboardFile = defineRpcFunction({
    name: 'read-dashboard-file',
    type: 'query',
    jsonSerializable: true,
    handler: async (input: unknown) => await fileReader.read(input),
  })

  const definition = defineDevframe({
    id: DEVFRAME_ID,
    name: 'weapp-vite',
    version: VERSION,
    packageName: 'weapp-vite',
    importMetaUrl: import.meta.url,
    homepage: 'https://vite.weapp.dev/',
    description: 'weapp-vite 构建分析与小程序开发工具。',
    icon: 'ph:rocket-launch-duotone',
    async setup(ctx) {
      ctx.rpc.register(rejectDashboardSharedStateSet, true)
      ctx.rpc.register(rejectDashboardSharedStatePatch, true)
      const dashboard = ctx.scope(DEVFRAME_ID)
      dashboard.rpc.register(getDashboardState)
      dashboard.rpc.register(getAnalyzePage)
      dashboard.rpc.register(readDashboardFile)
      broadcastDashboardState = async () => {
        await dashboard.rpc.broadcast({
          method: 'dashboard-state-updated',
          args: [createDashboardState(revision, serializedSnapshot, options.getRuntimeEvents())],
          event: true,
        })
      }
    },
  })

  return {
    definition,
    notifyAnalyzeUpdate() {
      revision += 1
      const snapshot = options.getAnalyzeSnapshot()
      serializedSnapshot = serializeDashboardAnalyzeSnapshot(snapshot, serializedSnapshot)
      fileReader.update(snapshot.current)
      void broadcastDashboardState?.()
    },
    syncRuntimeEvents() {
      void broadcastDashboardState?.()
    },
  }
}

export {
  createDashboardFileReader,
  MAX_DASHBOARD_FILE_CONTENT_BYTES,
  readDashboardFileContent,
}

export type {
  DashboardContentRoots,
  DashboardFileContent,
  DashboardFileKind,
}
