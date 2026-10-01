import type { DevframeDefinition } from 'devframe'
import type { AnalyzeSubpackagesResult } from '../analyze/subpackages'
import type { DashboardArtifactFiles } from './artifacts'
import type { DashboardContentRoots, DashboardFileContent, DashboardFileKind } from './content'
import type { DashboardRuntimeEvent, DashboardRuntimeEventInput } from './events'
import type {
  DashboardAnalyzePage,
  DashboardAnalyzePageRequest,
  DashboardAnalyzePayloadsDescriptor,
  SerializedDashboardAnalyzeSnapshot,
} from './payload'
import { defineDevframe, defineRpcFunction } from 'devframe'
import { VERSION } from '../constants'
import { createDashboardFileReader } from './content'
import { createDashboardRuntimeEvent, prependDashboardRuntimeEvents } from './events'
import {
  readDashboardAnalyzePage,
  serializeDashboardAnalyzeSnapshot,
  STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE,
} from './payload'
import {
  dashboardAnalyzePageRequestSchema,
  dashboardAnalyzePageSchema,
  dashboardFileContentSchema,
  dashboardFileReadRequestSchema,
  dashboardStateSchema,
} from './schema'

const DEVFRAME_ID = 'weapp-vite'

/** 报告与产物在发布后不可再修改；控制器只保留引用，不复制或清空调用方的 Map。 */
export interface DashboardAnalyzeSnapshot {
  current: AnalyzeSubpackagesResult
  previous: AnalyzeSubpackagesResult | null
  artifacts: DashboardArtifactFiles
}

interface DashboardDevframeState {
  analyze: DashboardAnalyzePayloadsDescriptor
  revision: number
  runtimeEvents: DashboardRuntimeEvent[]
}

export interface CreateAnalyzeDashboardDevframeOptions {
  snapshot: DashboardAnalyzeSnapshot
  roots: DashboardContentRoots
  initialEvents?: DashboardRuntimeEventInput[]
  /** 已构建面板的绝对目录；源码独立宿主可不提供。 */
  clientAssets?: string
}

/** 每个控制器对应一个宿主生命周期，宿主负责在关闭或启动失败时释放。 */
export interface AnalyzeDashboardDevframeController {
  readonly definition: DevframeDefinition
  update: (result: AnalyzeSubpackagesResult, artifacts: DashboardArtifactFiles, previousResult?: AnalyzeSubpackagesResult | null) => Promise<void>
  emitRuntimeEvents: (events: DashboardRuntimeEventInput[]) => void
  dispose: () => void
}

declare module 'devframe' {
  interface DevframeRpcClientFunctions {
    'weapp-vite:dashboard-state-updated': (state: DashboardDevframeState) => void
  }

  interface DevframeRpcServerFunctions {
    'weapp-vite:get-dashboard-state': () => DashboardDevframeState
    'weapp-vite:get-analyze-page': (input: DashboardAnalyzePageRequest) => DashboardAnalyzePage
    'weapp-vite:read-dashboard-file': (input: { kind: DashboardFileKind, path: string, revision: number }) => Promise<DashboardFileContent>
  }
}

/** 创建只读分析能力，不启动服务器，也不修改宿主的共享状态或认证策略。 */
export function createAnalyzeDashboardDevframe({
  snapshot: initialSnapshot,
  roots,
  initialEvents = [],
  clientAssets,
}: CreateAnalyzeDashboardDevframeOptions): AnalyzeDashboardDevframeController {
  let revision = 0
  let snapshot: DashboardAnalyzeSnapshot | undefined = initialSnapshot
  let serializedSnapshot: SerializedDashboardAnalyzeSnapshot | undefined = serializeDashboardAnalyzeSnapshot(initialSnapshot)
  let runtimeEvents = initialEvents.map(createDashboardRuntimeEvent)
  let broadcastDashboardState: (() => Promise<void>) | undefined
  const fileReader = createDashboardFileReader(roots, initialSnapshot.current, initialSnapshot.artifacts)

  function getState(): DashboardDevframeState {
    if (!serializedSnapshot) {
      throw new Error(STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE)
    }
    return {
      analyze: {
        current: serializedSnapshot.current.descriptor,
        previous: serializedSnapshot.previous?.descriptor ?? null,
      },
      revision,
      runtimeEvents: [...runtimeEvents],
    }
  }

  const getDashboardState = defineRpcFunction({
    name: 'get-dashboard-state',
    type: 'query',
    jsonSerializable: true,
    args: [],
    returns: dashboardStateSchema,
    agent: {
      title: 'Dashboard state',
      description: 'Read the live Dashboard revision, current and previous report page descriptors, and recent runtime events. Use this revision for subsequent report-page and file reads.',
      safety: 'read',
    },
    handler: getState,
  })
  const getAnalyzePage = defineRpcFunction({
    name: 'get-analyze-page',
    type: 'query',
    jsonSerializable: true,
    args: [dashboardAnalyzePageRequestSchema],
    returns: dashboardAnalyzePageSchema,
    agent: {
      title: 'Analyze report page',
      description: 'Read one bounded JSON-text page from the current or previous analyze report. Concatenate pages in index order to reconstruct the report; refresh Dashboard state when the revision changes.',
      safety: 'read',
    },
    handler: (input: unknown) => {
      if (!serializedSnapshot) {
        throw new Error(STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE)
      }
      return readDashboardAnalyzePage(input, revision, serializedSnapshot)
    },
  })
  const readDashboardFile = defineRpcFunction({
    name: 'read-dashboard-file',
    type: 'query',
    jsonSerializable: true,
    args: [dashboardFileReadRequestSchema],
    returns: dashboardFileContentSchema,
    agent: {
      title: 'Dashboard file content',
      description: 'Read a report-listed source file or captured build artifact at the current Dashboard revision. Source roots, report allowlists, symlink checks and file-size limits apply; artifacts come only from the analysis snapshot.',
      safety: 'read',
    },
    handler: async (input) => {
      const requestedRevision = input.revision
      if (!snapshot || requestedRevision !== revision) {
        throw new Error(STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE)
      }
      const content = await fileReader.read(input)
      if (!snapshot || requestedRevision !== revision) {
        throw new Error(STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE)
      }
      return content
    },
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
    capabilities: { dev: true, build: false },
    clientAssets,
    async setup(ctx) {
      if (!snapshot) {
        throw new Error(STALE_DASHBOARD_ANALYZE_REVISION_MESSAGE)
      }
      const dashboard = ctx.scope(DEVFRAME_ID)
      dashboard.rpc.register(getDashboardState)
      dashboard.rpc.register(getAnalyzePage)
      dashboard.rpc.register(readDashboardFile)
      broadcastDashboardState = async () => {
        await dashboard.rpc.broadcast({
          method: 'dashboard-state-updated',
          args: [getState()],
          event: true,
        })
      }
    },
  })

  return {
    definition,
    async update(result, artifacts, previousResult) {
      if (!snapshot) {
        return
      }
      const nextSnapshot = { current: result, previous: previousResult ?? snapshot.current, artifacts }
      const nextSerialized = serializeDashboardAnalyzeSnapshot(nextSnapshot, serializedSnapshot)
      fileReader.update(result, artifacts)
      snapshot = nextSnapshot
      serializedSnapshot = nextSerialized
      revision += 1
      runtimeEvents = prependDashboardRuntimeEvents(runtimeEvents, [{
        kind: 'build',
        level: 'info',
        title: 'analyze payload refreshed',
        detail: `已推送新的 analyze 结果，当前包含 ${result.packages.length} 个包与 ${result.modules.length} 个模块。`,
        tags: ['analyze', 'refresh'],
      }])
      await broadcastDashboardState?.()
    },
    emitRuntimeEvents(events) {
      if (!snapshot || events.length === 0) {
        return
      }
      runtimeEvents = prependDashboardRuntimeEvents(runtimeEvents, events)
      void broadcastDashboardState?.()
    },
    dispose() {
      if (!snapshot) {
        return
      }
      snapshot = undefined
      serializedSnapshot = undefined
      runtimeEvents = []
      broadcastDashboardState = undefined
      fileReader.dispose()
    },
  }
}

export type { AnalyzeSubpackagesResult } from '../analyze/subpackages'
export type { DashboardArtifactFile, DashboardArtifactFiles } from './artifacts'
export { createDashboardArtifactSnapshot } from './artifacts'
export { resolveDashboardClientAssets } from './assets'
export type { DashboardContentRoots } from './content'
export type { DashboardRuntimeEventInput, DashboardRuntimeEventProfile } from './events'
