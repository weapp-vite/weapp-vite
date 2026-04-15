import path from 'node:path'
import process from 'node:process'

export function toPosixPath(filePath: string) {
  return filePath.replace(/\\/gu, '/')
}

export function getRelativeDisplayPath(fromPath: string, toPath: string) {
  return toPosixPath(path.relative(fromPath, toPath))
}

export function normalizeComparablePath(filePath: string) {
  const normalizedPath = path.normalize(filePath)

  if (process.platform === 'win32') {
    return normalizedPath.toLowerCase()
  }

  return normalizedPath
}

export function isSameOrDescendantPath(candidatePath: string, targetPath: string) {
  const normalizedCandidatePath = normalizeComparablePath(candidatePath)
  const normalizedTargetPath = normalizeComparablePath(targetPath)

  return normalizedCandidatePath === normalizedTargetPath
    || normalizedCandidatePath.startsWith(`${normalizedTargetPath}${path.sep}`)
}
