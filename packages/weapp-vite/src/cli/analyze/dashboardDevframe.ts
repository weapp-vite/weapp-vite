import type { DevframeDefinition } from 'devframe'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import fs from 'node:fs'
import { defineDevframe, defineRpcFunction } from 'devframe'
import path from 'pathe'
import { VERSION } from '../../constants'

const DEVFRAME_ID = 'weapp-vite'
export const MAX_DASHBOARD_FILE_CONTENT_BYTES = 2 * 1024 * 1024

export interface DashboardAnalyzeSnapshot {
  current: AnalyzeSubpackagesResult
  previous: AnalyzeSubpackagesResult | null
}

export interface DashboardDevframeSharedState {
  revision: number
  runtimeEvents: unknown[]
}

export interface DashboardFileContent {
  content: string
  kind: DashboardFileKind
  language: string
  path: string
  size: number
}

export type DashboardFileKind = 'artifact' | 'source'

interface DashboardContentRoots {
  artifactRoot?: string
  sourceRoot?: string
}

interface DashboardContentAllowlist {
  artifactPaths: Set<string>
  sourcePaths: Set<string>
}

interface DashboardFileRequest {
  kind: DashboardFileKind
  path: string
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
  interface DevframeRpcServerFunctions {
    'weapp-vite:get-analyze-state': () => DashboardAnalyzeSnapshot
    'weapp-vite:read-dashboard-file': (input: DashboardFileRequest) => Promise<DashboardFileContent>
  }

  interface DevframeRpcSharedStates {
    'weapp-vite:dashboard': DashboardDevframeSharedState
  }
}

function normalizeDashboardRelativePath(value: string) {
  return value.replaceAll('\\', '/')
}

function stripDashboardFileQuery(value: string) {
  const queryIndex = value.indexOf('?')
  return queryIndex === -1 ? value : value.slice(0, queryIndex)
}

function addDashboardAllowedPath(paths: Set<string>, value: string | undefined) {
  if (!value || value.includes('\0')) {
    return
  }
  const normalizedPath = normalizeDashboardRelativePath(stripDashboardFileQuery(value))
  if (!normalizedPath || path.isAbsolute(normalizedPath)) {
    return
  }
  paths.add(normalizedPath)
}

function createDashboardContentAllowlist(result: AnalyzeSubpackagesResult): DashboardContentAllowlist {
  const artifactPaths = new Set<string>()
  const sourcePaths = new Set<string>()

  for (const packageReport of result.packages) {
    for (const file of packageReport.files) {
      addDashboardAllowedPath(artifactPaths, file.file)
      addDashboardAllowedPath(sourcePaths, file.source)
      for (const module of file.modules ?? []) {
        addDashboardAllowedPath(sourcePaths, module.source)
      }
    }
  }

  return {
    artifactPaths,
    sourcePaths,
  }
}

function resolveDashboardContentPath(
  root: string | undefined,
  requestPath: string,
  options: { allowParent?: boolean, allowedPaths: Set<string> },
) {
  if (!root || !requestPath || requestPath.includes('\0')) {
    return undefined
  }

  const normalizedRequestPath = normalizeDashboardRelativePath(stripDashboardFileQuery(requestPath))
  if (path.isAbsolute(normalizedRequestPath) || !options.allowedPaths.has(normalizedRequestPath)) {
    return undefined
  }

  const resolvedRoot = path.resolve(root)
  const absolutePath = path.resolve(resolvedRoot, normalizedRequestPath)
  const relativePath = path.relative(resolvedRoot, absolutePath)

  if (!relativePath || (!options.allowParent && (relativePath.startsWith('..') || path.isAbsolute(relativePath)))) {
    return undefined
  }

  return {
    absolutePath,
    relativePath: options.allowParent
      ? normalizedRequestPath
      : normalizeDashboardRelativePath(relativePath),
  }
}

function resolveDashboardFileLanguage(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs' || extension === '.wxs' || extension === '.sjs') {
    return 'javascript'
  }
  if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
    return 'typescript'
  }
  if (extension === '.json' || extension === '.map') {
    return 'json'
  }
  if (extension === '.css' || extension === '.wxss' || extension === '.scss' || extension === '.sass' || extension === '.less') {
    return 'css'
  }
  if (extension === '.vue' || extension === '.wxml' || extension === '.html') {
    return 'html'
  }
  return 'plaintext'
}

function normalizeDashboardFileRequest(input: unknown): DashboardFileRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }

  if (!('kind' in input) || !('path' in input)) {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }
  const kind = input.kind
  const requestPath = input.path
  if ((kind !== 'source' && kind !== 'artifact') || typeof requestPath !== 'string') {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }

  return { kind, path: requestPath }
}

export async function readDashboardFileContent(
  input: unknown,
  roots: DashboardContentRoots,
  result: AnalyzeSubpackagesResult,
): Promise<DashboardFileContent> {
  const request = normalizeDashboardFileRequest(input)
  const allowlist = createDashboardContentAllowlist(result)
  const allowedPaths = request.kind === 'artifact'
    ? allowlist.artifactPaths
    : allowlist.sourcePaths
  const baseRoot = request.kind === 'artifact' ? roots.artifactRoot : roots.sourceRoot
  const candidateRoots = request.kind === 'source' && baseRoot
    ? [path.resolve(baseRoot, 'src'), baseRoot]
    : [baseRoot]
  const resolvedCandidates = candidateRoots.flatMap((root) => {
    const resolved = resolveDashboardContentPath(root, request.path, {
      allowParent: request.kind === 'source',
      allowedPaths,
    })
    return resolved ? [resolved] : []
  })

  if (resolvedCandidates.length === 0) {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }

  for (const resolved of resolvedCandidates) {
    try {
      const stat = await fs.promises.stat(resolved.absolutePath)
      if (!stat.isFile()) {
        throw new Error('目标路径不是文件。')
      }
      if (stat.size > MAX_DASHBOARD_FILE_CONTENT_BYTES) {
        throw new Error(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节，已拒绝读取。`)
      }

      return {
        kind: request.kind,
        path: resolved.relativePath,
        language: resolveDashboardFileLanguage(resolved.relativePath),
        size: stat.size,
        content: await fs.promises.readFile(resolved.absolutePath, 'utf8'),
      }
    }
    catch (error) {
      if (error instanceof Error && (
        error.message === '目标路径不是文件。'
        || error.message.startsWith('文件超过 ')
      )) {
        throw error
      }
      const code = typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : ''
      if (code !== 'ENOENT') {
        throw new Error('读取文件失败。')
      }
    }
  }

  throw new Error('文件不存在。')
}

export function createAnalyzeDashboardDevframe(
  options: CreateDashboardDevframeOptions,
): AnalyzeDashboardDevframeController {
  let mutateSharedState: ((mutate: (state: DashboardDevframeSharedState) => void) => void) | undefined

  const getAnalyzeState = defineRpcFunction({
    name: 'get-analyze-state',
    type: 'query',
    handler: () => options.getAnalyzeSnapshot(),
  })
  const readDashboardFile = defineRpcFunction({
    name: 'read-dashboard-file',
    type: 'query',
    handler: async (input: unknown) => await readDashboardFileContent(
      input,
      options.roots,
      options.getAnalyzeSnapshot().current,
    ),
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
      const dashboard = ctx.scope(DEVFRAME_ID)
      dashboard.rpc.register(getAnalyzeState)
      dashboard.rpc.register(readDashboardFile)
      const sharedState = await dashboard.rpc.sharedState('dashboard', {
        initialValue: {
          revision: 0,
          runtimeEvents: [...options.getRuntimeEvents()],
        } satisfies DashboardDevframeSharedState,
      })
      mutateSharedState = (mutate) => {
        sharedState.mutate(mutate)
      }
    },
  })

  return {
    definition,
    notifyAnalyzeUpdate() {
      mutateSharedState?.((state) => {
        state.revision += 1
      })
    },
    syncRuntimeEvents() {
      mutateSharedState?.((state) => {
        state.runtimeEvents = [...options.getRuntimeEvents()]
      })
    },
  }
}
