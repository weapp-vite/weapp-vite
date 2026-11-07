import type { ArtifactContent } from '../kernel/artifactContent'
import { normalize } from 'pathe'
import { copyArtifactBinary, readArtifactText } from '../kernel/artifactContent'

export interface BrowserDirectoryFileLike {
  name: string
  arrayBuffer?: () => Promise<ArrayBuffer>
  text: () => Promise<string>
  webkitRelativePath?: string
}

export type BrowserVirtualFiles<T extends ArtifactContent = ArtifactContent> = Map<string, T>

export function normalizeBrowserFilePath(filePath: string) {
  return normalize(filePath)
    .replace(/^\/+/, '')
    .replace(/^\.\//, '')
}

export function createBrowserVirtualFiles<T extends ArtifactContent>(entries: Iterable<[string, T]>) {
  const files: BrowserVirtualFiles<T> = new Map()
  for (const [filePath, content] of entries) {
    files.set(normalizeBrowserFilePath(filePath), (typeof content === 'string' ? content : copyArtifactBinary(content)) as T)
  }
  return files
}

export async function createBrowserVirtualFilesFromDirectory(files: BrowserDirectoryFileLike[]) {
  const entries: Array<[string, ArtifactContent]> = await Promise.all(files.map(async (file) => {
    const relativePath = file.webkitRelativePath?.trim() || file.name
    return [relativePath, file.arrayBuffer ? await file.arrayBuffer() : await file.text()]
  }))
  return createBrowserVirtualFiles(entries)
}

export function readBrowserVirtualFile(files: BrowserVirtualFiles, filePath: string) {
  const content = files.get(normalizeBrowserFilePath(filePath))
  return content === undefined ? undefined : readArtifactText(content)
}

export function readBrowserVirtualBinary(files: BrowserVirtualFiles, filePath: string) {
  const content = files.get(normalizeBrowserFilePath(filePath))
  return content === undefined ? undefined : copyArtifactBinary(content)
}

export function hasBrowserVirtualFile(files: BrowserVirtualFiles, filePath: string) {
  return files.has(normalizeBrowserFilePath(filePath))
}
