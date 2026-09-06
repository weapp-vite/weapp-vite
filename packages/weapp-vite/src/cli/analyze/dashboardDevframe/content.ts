import type { FileHandle } from 'node:fs/promises'
import type { AnalyzeSubpackagesResult } from '../../../analyze/subpackages'
import type {
  DashboardContentAllowlist,
  DashboardContentRoots,
  DashboardFileKind,
  ResolvedDashboardContentPath,
} from './paths'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import process from 'node:process'
import path from 'pathe'
import {
  createDashboardContentAllowlist,
  resolveDashboardContentCandidates,
} from './paths'

export const MAX_DASHBOARD_FILE_CONTENT_BYTES = 2 * 1024 * 1024

export interface DashboardFileContent {
  content: string
  kind: DashboardFileKind
  language: string
  path: string
  size: number
}

interface DashboardFileRequest {
  kind: DashboardFileKind
  path: string
}

export interface DashboardFileReader {
  read: (input: unknown) => Promise<DashboardFileContent>
  update: (result: AnalyzeSubpackagesResult) => void
}

function isPathWithin(rootPath: string, targetPath: string) {
  const relativePath = path.relative(rootPath, targetPath)
  return !relativePath || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function resolveInspectionRoot(resolved: ResolvedDashboardContentPath) {
  let inspectionRoot = resolved.rootPath
  if (!resolved.allowParent) {
    return inspectionRoot
  }
  while (!isPathWithin(inspectionRoot, resolved.absolutePath)) {
    const parent = path.dirname(inspectionRoot)
    if (parent === inspectionRoot) {
      return undefined
    }
    inspectionRoot = parent
  }
  return inspectionRoot
}

async function assertDashboardPathHasNoSymlink(resolved: ResolvedDashboardContentPath) {
  const inspectionRoot = resolveInspectionRoot(resolved)
  if (!inspectionRoot) {
    throw new Error('文件路径超出允许范围。')
  }
  const relativePath = path.relative(inspectionRoot, resolved.absolutePath)
  let currentPath = inspectionRoot
  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment)
    if ((await fs.promises.lstat(currentPath)).isSymbolicLink()) {
      throw new Error('文件路径包含不允许的符号链接。')
    }
  }
}

function isSameOpenedFile(pathStat: fs.Stats, handleStat: fs.Stats) {
  if (pathStat.dev !== handleStat.dev) {
    return false
  }
  return pathStat.ino === 0 || handleStat.ino === 0 || pathStat.ino === handleStat.ino
}

async function openDashboardFile(resolved: ResolvedDashboardContentPath) {
  await assertDashboardPathHasNoSymlink(resolved)
  const flags = process.platform === 'win32'
    ? fs.constants.O_RDONLY
    : fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
  const handle = await fs.promises.open(resolved.absolutePath, flags)
  try {
    await assertDashboardPathHasNoSymlink(resolved)
    const [pathStat, handleStat] = await Promise.all([
      fs.promises.stat(resolved.absolutePath),
      handle.stat(),
    ])
    if (!isSameOpenedFile(pathStat, handleStat)) {
      throw new Error('文件路径在读取期间发生变化。')
    }
    return handle
  }
  catch (error) {
    await handle.close()
    throw error
  }
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

  return { content: content.subarray(0, offset).toString('utf8'), size: offset }
}

function resolveDashboardFileLanguage(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (['.js', '.mjs', '.cjs', '.wxs', '.sjs'].includes(extension)) {
    return 'javascript'
  }
  if (['.ts', '.mts', '.cts'].includes(extension)) {
    return 'typescript'
  }
  if (['.json', '.map'].includes(extension)) {
    return 'json'
  }
  if (['.css', '.wxss', '.scss', '.sass', '.less'].includes(extension)) {
    return 'css'
  }
  if (['.vue', '.wxml', '.html'].includes(extension)) {
    return 'html'
  }
  return 'plaintext'
}

function normalizeDashboardFileRequest(input: unknown): DashboardFileRequest {
  if (!input || typeof input !== 'object' || !('kind' in input) || !('path' in input)) {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }
  const kind = input.kind
  const requestPath = input.path
  if ((kind !== 'source' && kind !== 'artifact') || typeof requestPath !== 'string') {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }
  return { kind, path: requestPath }
}

async function readAllowedDashboardFile(
  input: unknown,
  roots: DashboardContentRoots,
  allowlist: DashboardContentAllowlist,
): Promise<DashboardFileContent> {
  const request = normalizeDashboardFileRequest(input)
  const resolvedCandidates = resolveDashboardContentCandidates(request.kind, request.path, roots, allowlist)
  if (resolvedCandidates.length === 0) {
    throw new Error('必须传入合法的 kind 和相对路径。')
  }

  const openedCandidates: Array<{ handle: FileHandle, resolved: ResolvedDashboardContentPath }> = []
  try {
    for (const resolved of resolvedCandidates) {
      try {
        openedCandidates.push({ handle: await openDashboardFile(resolved), resolved })
      }
      catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
        if (code !== 'ENOENT') {
          throw error
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
      || error.message === '源码路径存在多个候选文件，已拒绝读取。'
      || error.message === '目标路径不是文件。'
      || error.message.startsWith('文件超过 ')
      || error.message.startsWith('文件路径')
    )) {
      throw error
    }
    throw new Error('读取文件失败。')
  }
  finally {
    await Promise.allSettled(openedCandidates.map(candidate => candidate.handle.close()))
  }
}

export function createDashboardFileReader(
  roots: DashboardContentRoots,
  result: AnalyzeSubpackagesResult,
): DashboardFileReader {
  let allowlist = createDashboardContentAllowlist(result)
  return {
    read: async input => await readAllowedDashboardFile(input, roots, allowlist),
    update(nextResult) {
      allowlist = createDashboardContentAllowlist(nextResult)
    },
  }
}

export async function readDashboardFileContent(
  input: unknown,
  roots: DashboardContentRoots,
  result: AnalyzeSubpackagesResult,
) {
  return await createDashboardFileReader(roots, result).read(input)
}

export type {
  DashboardContentRoots,
  DashboardFileKind,
}
