import type { ArtifactContent } from './artifactContent'
import fs from 'node:fs'
import path from 'node:path'
import { copyArtifactBinary, readArtifactText } from './artifactContent'

export interface ArtifactSource {
  /** 判断产物文件是否存在，目录不属于产物。 */
  has: (filePath: string) => boolean
  readBinary?: (filePath: string) => ArrayBuffer | undefined
  readText: (filePath: string) => string | undefined
}

function normalizeArtifactPath(filePath: string) {
  return path.normalize(path.resolve(filePath))
}

export function createFileSystemArtifactSource(): ArtifactSource {
  return {
    has(filePath) {
      try {
        // stat 跟随符号链接，目录候选继续交由模块解析查找 index 文件。
        return fs.statSync(filePath).isFile()
      }
      catch {
        return false
      }
    },
    readText(filePath) {
      try {
        return fs.readFileSync(filePath, 'utf8')
      }
      catch {
        return undefined
      }
    },
    readBinary(filePath) {
      try {
        return new Uint8Array(fs.readFileSync(filePath)).buffer
      }
      catch {
        return undefined
      }
    },
  }
}

export function createMemoryArtifactSource(entries: Iterable<[string, ArtifactContent]>): ArtifactSource {
  const files = new Map<string, ArtifactContent>()
  for (const [filePath, content] of entries) {
    files.set(normalizeArtifactPath(filePath), typeof content === 'string' ? content : copyArtifactBinary(content))
  }
  return {
    has: filePath => files.has(normalizeArtifactPath(filePath)),
    readText(filePath) {
      const content = files.get(normalizeArtifactPath(filePath))
      return content === undefined ? undefined : readArtifactText(content)
    },
    readBinary(filePath) {
      const content = files.get(normalizeArtifactPath(filePath))
      return content === undefined ? undefined : copyArtifactBinary(content)
    },
  }
}

export function createOverlayArtifactSource(
  overlay: ArtifactSource,
  fallback: ArtifactSource,
): ArtifactSource {
  return {
    has: filePath => overlay.has(filePath) || fallback.has(filePath),
    readText(filePath) {
      return overlay.has(filePath)
        ? overlay.readText(filePath)
        : fallback.readText(filePath)
    },
    readBinary(filePath) {
      const source = overlay.has(filePath) ? overlay : fallback
      return source.readBinary?.(filePath)
    },
  }
}
