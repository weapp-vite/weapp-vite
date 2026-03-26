import { normalize } from 'pathe'

export interface BrowserDirectoryFileLike {
  name: string
  text: () => Promise<string>
  webkitRelativePath?: string
}

export type BrowserVirtualFiles = Map<string, string>

export function normalizeBrowserFilePath(filePath: string) {
  return normalize(filePath)
    .replace(/^\/+/, '')
    .replace(/^\.\//, '')
}

export function createBrowserVirtualFiles(entries: Iterable<[string, string]>) {
  const files: BrowserVirtualFiles = new Map()
  for (const [filePath, content] of entries) {
    files.set(normalizeBrowserFilePath(filePath), content)
  }
  return files
}

export async function createBrowserVirtualFilesFromDirectory(files: BrowserDirectoryFileLike[]) {
  const entries: Array<[string, string]> = await Promise.all(files.map(async (file) => {
    const relativePath = file.webkitRelativePath?.trim() || file.name
    return [relativePath, await file.text()]
  }))
  return createBrowserVirtualFiles(entries)
}

export function readBrowserVirtualFile(files: BrowserVirtualFiles, filePath: string) {
  return files.get(normalizeBrowserFilePath(filePath))
}

export function hasBrowserVirtualFile(files: BrowserVirtualFiles, filePath: string) {
  return files.has(normalizeBrowserFilePath(filePath))
}
