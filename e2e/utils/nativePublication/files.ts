import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export const NATIVE_PUBLICATION_PREFIX = '[native-publication] '

export interface NativePublicationOptions {
  sourceRoot?: string
  profilePath?: string
}

export interface NativePublicationProfileCursor {
  offset: number
  prefixHash: string
}

export interface NativePublicationReceipt {
  boundary: 'native-byte-write'
  generation: string
  inputs: Record<string, string>
  outputs: Record<string, string>
  profileCursor?: NativePublicationProfileCursor
}

export function nativePublicationHash(source: string | Uint8Array) {
  return createHash('sha256').update(source).digest('hex')
}

export function nativePublicationGeneration(files: Record<string, string>) {
  return nativePublicationHash(JSON.stringify(Object.entries(files).sort(([left], [right]) => left.localeCompare(right))))
}

/** 输入指纹仅包含真实源码和构建配置，不把 IDE 私有配置或生成目录算成保存来源。 */
export async function readNativePublicationInputs(project: string, options: NativePublicationOptions = {}, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const sourceRoot = options.sourceRoot ?? 'src'
  const sources = (await readdir(path.join(project, sourceRoot), { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile() && !entry.name.endsWith('.tmp'))
    .map(entry => path.relative(project, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  const configs = (await readdir(project)).filter(file => /^weapp-vite\.config\.[cm]?[jt]s$/.test(file))
  const files = [...sources, ...configs].sort()
  return Object.fromEntries(await Promise.all(files.map(async file => [file, nativePublicationHash(await readFile(path.join(project, file), { signal }))])))
}
