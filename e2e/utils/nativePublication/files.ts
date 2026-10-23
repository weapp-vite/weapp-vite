import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export const NATIVE_PUBLICATION_PREFIX = '[native-publication] '

export interface NativePublicationOptions {
  sourceRoot?: string
  outputRoot?: string
  profilePath?: string
}

export interface NativePublicationProfileCursor {
  offset: number
  prefixHash: string
}

export interface NativePublicationReceipt {
  boundary: 'native-byte-write' | 'native-noop'
  generation: string
  inputs: Record<string, string>
  outputs: Record<string, string>
  profileCursor?: NativePublicationProfileCursor
  publicationEpoch?: number
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
  const outputRoot = path.resolve(project, options.outputRoot ?? 'dist')
  const generatedDirectories = new Set(['node_modules', '.weapp-vite', '.turbo', '.tmp', '.git', '.codex-tmp'])
  const sources: string[] = []
  const collect = async (directory: string) => {
    signal?.throwIfAborted()
    if (path.resolve(directory) === outputRoot) {
      return
    }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory() && !generatedDirectories.has(entry.name)) {
        await collect(file)
      }
      else if (entry.isFile() && !entry.name.endsWith('.tmp') && !/^\.weapp-vite-e2e-[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\.config\.mjs$/.test(entry.name)) {
        sources.push(path.relative(project, file).replaceAll('\\', '/'))
      }
    }
  }
  await collect(path.join(project, sourceRoot))
  const configs = (await readdir(project)).filter(file => /^weapp-vite\.config\.[cm]?[jt]s$/.test(file))
  const files = [...sources, ...configs].sort()
  return Object.fromEntries(await Promise.all(files.map(async file => [file, nativePublicationHash(await readFile(path.join(project, file), { signal }))])))
}
