import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

export interface WevuVendorChunk {
  path: string
  code: string
}

export type WevuVendorPredicate = (code: string, filePath: string) => boolean

async function readVendorChunks(distRoot: string): Promise<WevuVendorChunk[]> {
  const vendorRoot = path.join(distRoot, 'weapp-vendors')
  if (!(await fs.pathExists(vendorRoot))) {
    return []
  }

  const files = await fs.readdir(vendorRoot)
  const chunks: WevuVendorChunk[] = []

  for (const file of files) {
    if (!file.endsWith('.js')) {
      continue
    }

    const filePath = path.join(vendorRoot, file)
    chunks.push({
      path: filePath,
      code: await fs.readFile(filePath, 'utf8'),
    })
  }

  return chunks
}

async function readDistJsChunks(distRoot: string): Promise<WevuVendorChunk[]> {
  const chunks: WevuVendorChunk[] = []
  if (!(await fs.pathExists(distRoot))) {
    return chunks
  }

  const files = await fs.readdir(distRoot, { recursive: true })
  for (const file of files) {
    if (typeof file !== 'string' || !file.endsWith('.js')) {
      continue
    }

    const filePath = path.join(distRoot, file)
    chunks.push({
      path: filePath,
      code: await fs.readFile(filePath, 'utf8'),
    })
  }

  return chunks
}

function resolveChunk(
  chunks: WevuVendorChunk[],
  distRoot: string,
  predicate: WevuVendorPredicate,
  label: string,
) {
  for (const chunk of chunks) {
    if (predicate(chunk.code, chunk.path)) {
      return chunk
    }
  }

  const files = chunks.map(chunk => path.relative(distRoot, chunk.path).replaceAll('\\', '/'))
  throw new Error(`Failed to resolve wevu chunk for ${label}. files=${JSON.stringify(files)}`)
}

/**
 * 在 wevu vendor 目录中查找匹配语义内容的 chunk。
 *
 * @param distRoot - 小程序产物目录
 * @param predicate - chunk 内容判断函数
 * @param label - 错误信息中的语义标签
 * @returns 匹配到的 chunk 路径和源码
 */
export async function findWevuVendorChunk(
  distRoot: string,
  predicate: WevuVendorPredicate,
  label: string,
): Promise<WevuVendorChunk> {
  const chunks = await readVendorChunks(distRoot)

  return resolveChunk(chunks, distRoot, predicate, label)
}

/**
 * 在 wevu vendor 目录优先查找，找不到时回退到完整 JS 产物。
 *
 * @param distRoot - 小程序产物目录
 * @param predicate - chunk 内容判断函数
 * @param label - 错误信息中的语义标签
 * @returns 匹配到的 chunk 路径和源码
 */
export async function findWevuSemanticChunk(
  distRoot: string,
  predicate: WevuVendorPredicate,
  label: string,
): Promise<WevuVendorChunk> {
  const vendorChunks = await readVendorChunks(distRoot)
  for (const chunk of vendorChunks) {
    if (predicate(chunk.code, chunk.path)) {
      return chunk
    }
  }

  return resolveChunk(await readDistJsChunks(distRoot), distRoot, predicate, label)
}

/**
 * 在完整小程序产物中查找匹配语义内容的 JS chunk。
 *
 * @param distRoot - 小程序产物目录
 * @param predicate - chunk 内容判断函数
 * @param label - 错误信息中的语义标签
 * @returns 匹配到的 chunk 路径和源码
 */
export async function findWevuRuntimeChunk(
  distRoot: string,
  predicate: WevuVendorPredicate,
  label: string,
): Promise<WevuVendorChunk> {
  const chunks = await readDistJsChunks(distRoot)

  return resolveChunk(chunks, distRoot, predicate, label)
}

/**
 * 在 wevu vendor 目录中查找包含全部片段的 chunk。
 *
 * @param distRoot - 小程序产物目录
 * @param snippets - 期望同时出现的源码片段
 * @returns 匹配到的 chunk 路径和源码
 */
export async function findWevuVendorChunkContaining(
  distRoot: string,
  snippets: string[],
): Promise<WevuVendorChunk> {
  return findWevuSemanticChunk(
    distRoot,
    code => snippets.every(snippet => code.includes(snippet)),
    snippets.join(' + '),
  )
}

/**
 * 轮询等待 wevu vendor chunk 出现指定标记。
 *
 * @param distRoot - 小程序产物目录
 * @param marker - 期望包含的标记字符串
 * @param timeoutMs - 超时时间
 * @returns 匹配到的 chunk 路径和源码
 */
export async function waitForWevuVendorChunkContaining(
  distRoot: string,
  marker: string,
  timeoutMs = 90_000,
): Promise<WevuVendorChunk> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      return await findWevuVendorChunkContaining(distRoot, [marker])
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  throw new Error(`Timed out waiting for wevu vendor chunk under ${distRoot} to contain marker: ${marker}`)
}

/**
 * 轮询等待完整 JS 产物中出现指定标记。
 *
 * @param distRoot - 小程序产物目录
 * @param marker - 期望包含的标记字符串
 * @param timeoutMs - 超时时间
 * @returns 匹配到的 chunk 路径和源码
 */
export async function waitForWevuRuntimeChunkContaining(
  distRoot: string,
  marker: string,
  timeoutMs = 90_000,
): Promise<WevuVendorChunk> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      return await findWevuSemanticChunk(distRoot, code => code.includes(marker), marker)
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  throw new Error(`Timed out waiting for wevu runtime chunk under ${distRoot} to contain marker: ${marker}`)
}

export function toRelativeImport(fromFilePath: string, toFilePath: string) {
  const relativePath = path.relative(path.dirname(fromFilePath), toFilePath).replaceAll('\\', '/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}
