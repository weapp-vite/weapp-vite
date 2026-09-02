import type { DevframeDefinition } from 'devframe'
import type { FileHandle } from 'node:fs/promises'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import { Buffer } from 'node:buffer'
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

interface ResolvedDashboardContentPath {
  absolutePath: string
  relativePath: string
}

type DashboardSourceRootKind = 'project' | 'src'

interface DashboardContentAllowlist {
  artifactPaths: Set<string>
  sourcePaths: Map<string, Set<DashboardSourceRootKind>>
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

function addDashboardAllowedSourcePath(
  paths: Map<string, Set<DashboardSourceRootKind>>,
  value: string | undefined,
  rootKind: DashboardSourceRootKind,
) {
  if (!value || value.includes('\0')) {
    return
  }
  const normalizedPath = normalizeDashboardRelativePath(stripDashboardFileQuery(value))
  if (!normalizedPath || path.isAbsolute(normalizedPath)) {
    return
  }
  const rootKinds = paths.get(normalizedPath) ?? new Set<DashboardSourceRootKind>()
  rootKinds.add(rootKind)
  paths.set(normalizedPath, rootKinds)
}

function createDashboardContentAllowlist(result: AnalyzeSubpackagesResult): DashboardContentAllowlist {
  const artifactPaths = new Set<string>()
  const sourcePaths = new Map<string, Set<DashboardSourceRootKind>>()

  for (const packageReport of result.packages) {
    for (const file of packageReport.files) {
      addDashboardAllowedPath(artifactPaths, file.file)
      addDashboardAllowedSourcePath(sourcePaths, file.source, 'src')
      for (const module of file.modules ?? []) {
        addDashboardAllowedSourcePath(sourcePaths, module.source, module.sourceType === 'src' ? 'src' : 'project')
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
): ResolvedDashboardContentPath | undefined {
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

function resolveDashboardSourceContentPaths(
  sourceRoot: string | undefined,
  requestPath: string,
  allowedPaths: Map<string, Set<DashboardSourceRootKind>>,
): ResolvedDashboardContentPath[] {
  if (!sourceRoot) {
    return []
  }
  const normalizedRequestPath = normalizeDashboardRelativePath(stripDashboardFileQuery(requestPath))
  const rootKinds = allowedPaths.get(normalizedRequestPath)
  if (!rootKinds || rootKinds.size !== 1) {
    return []
  }

  const [rootKind] = rootKinds
  if (rootKind === 'project') {
    const resolved = resolveDashboardContentPath(sourceRoot, normalizedRequestPath, {
      allowParent: true,
      allowedPaths: new Set([normalizedRequestPath]),
    })
    return resolved ? [resolved] : []
  }

  const sourceRootPath = path.resolve(sourceRoot, 'src')
  const relativePaths = normalizedRequestPath.startsWith('src/')
    ? [normalizedRequestPath, normalizedRequestPath.slice(4)]
    : [normalizedRequestPath]
  const candidates = relativePaths.flatMap((relativePath) => {
    const resolved = resolveDashboardContentPath(sourceRootPath, relativePath, {
      allowedPaths: new Set([relativePath]),
    })
    return resolved
      ? [{
          ...resolved,
          relativePath: normalizedRequestPath,
        }]
      : []
  })
  const uniqueCandidates = new Map(candidates.map(candidate => [candidate.absolutePath, candidate]))
  return [...uniqueCandidates.values()]
}

async function readDashboardFileHandle(handle: FileHandle) {
  const stat = await handle.stat()
  if (!stat.isFile()) {
    throw new Error('目标路径不是文件。')
  }
  if (stat.size > MAX_DASHBOARD_FILE_CONTENT_BYTES) {
    throw new Error(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节，已拒绝读取。`)
  }

  let content = Buffer.allocUnsafe(Math.min(Math.max(stat.size + 1, 1), MAX_DASHBOARD_FILE_CONTENT_BYTES + 1))
  let offset = 0
  while (true) {
    if (offset === content.length) {
      if (content.length === MAX_DASHBOARD_FILE_CONTENT_BYTES + 1) {
        throw new Error(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节，已拒绝读取。`)
      }
      const expanded = Buffer.allocUnsafe(Math.min(content.length * 2, MAX_DASHBOARD_FILE_CONTENT_BYTES + 1))
      content.copy(expanded, 0, 0, offset)
      content = expanded
    }
    const { bytesRead } = await handle.read(content, offset, content.length - offset, offset)
    if (bytesRead === 0) {
      break
    }
    offset += bytesRead
    if (offset > MAX_DASHBOARD_FILE_CONTENT_BYTES) {
      throw new Error(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节，已拒绝读取。`)
    }
  }

  return {
    content: content.subarray(0, offset).toString('utf8'),
    size: offset,
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
  const artifactPath = request.kind === 'artifact'
    ? resolveDashboardContentPath(roots.artifactRoot, request.path, {
        allowedPaths: allowlist.artifactPaths,
      })
    : undefined
  const resolvedCandidates = request.kind === 'artifact'
    ? artifactPath ? [artifactPath] : []
    : resolveDashboardSourceContentPaths(roots.sourceRoot, request.path, allowlist.sourcePaths)

  if (resolvedCandidates.length === 0) {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }

  const openedCandidates: Array<{ handle: FileHandle, resolved: ResolvedDashboardContentPath }> = []
  try {
    for (const resolved of resolvedCandidates) {
      try {
        const handle = await fs.promises.open(resolved.absolutePath, 'r')
        openedCandidates.push({ handle, resolved })
      }
      catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
          ? String(error.code)
          : ''
        if (code !== 'ENOENT') {
          throw new Error('读取文件失败。')
        }
      }
    }

    if (openedCandidates.length === 0) {
      throw new Error('文件不存在。')
    }
    if (openedCandidates.length > 1) {
      throw new Error('源码路径存在多个候选文件，已拒绝读取。')
    }

    const [{ handle, resolved }] = openedCandidates
    const file = await readDashboardFileHandle(handle)
    return {
      kind: request.kind,
      path: resolved.relativePath,
      language: resolveDashboardFileLanguage(resolved.relativePath),
      size: file.size,
      content: file.content,
    }
  }
  catch (error) {
    if (error instanceof Error && (
      error.message === '文件不存在。'
      || error.message === '读取文件失败。'
      || error.message === '源码路径存在多个候选文件，已拒绝读取。'
      || error.message === '目标路径不是文件。'
      || error.message.startsWith('文件超过 ')
    )) {
      throw error
    }
    throw new Error('读取文件失败。')
  }
  finally {
    await Promise.allSettled(openedCandidates.map(candidate => candidate.handle.close()))
  }
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
