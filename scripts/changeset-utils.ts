import fs from 'node:fs/promises'
import path from 'node:path'

export function extractChangesetPackages(content: string) {
  const lines = content.split('\n')
  let start = -1
  let end = -1

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim()
    if (line === '---') {
      if (start === -1) {
        start = i
      }
      else {
        end = i
        break
      }
    }
  }

  if (start === -1 || end === -1 || end <= start + 1) {
    return []
  }

  const packages = new Set<string>()
  for (let i = start + 1; i < end; i += 1) {
    const trimmed = lines[i]?.trim()
    if (!trimmed) {
      continue
    }
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex <= 0) {
      continue
    }
    let key = trimmed.slice(0, colonIndex).trim()
    if (
      (key.startsWith('"') && key.endsWith('"'))
      || (key.startsWith('\'') && key.endsWith('\''))
    ) {
      key = key.slice(1, -1)
    }
    if (key) {
      packages.add(key)
    }
  }

  return [...packages]
}

export async function collectChangesetPackages(changedChangesetFiles: string[]) {
  const changesetPackages = new Set<string>()

  for (const file of changedChangesetFiles) {
    try {
      const content = await fs.readFile(file, 'utf8')
      for (const pkg of extractChangesetPackages(content)) {
        changesetPackages.add(pkg)
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      throw error
    }
  }

  return changesetPackages
}

export function hasReleaseArtifactsForPackage(changedFiles: string[], packageDir: string) {
  const normalizedDir = packageDir.replaceAll('\\', '/').replace(/\/$/, '')
  const expectedFiles = new Set([
    `${normalizedDir}/package.json`,
    `${normalizedDir}/CHANGELOG.md`,
  ])

  return changedFiles.some(file => expectedFiles.has(file.replaceAll('\\', '/')))
}

export function hasNonReleaseArtifactTemplateChange(changedFiles: string[]) {
  return changedFiles.some((file) => {
    const normalizedFile = file.replaceAll('\\', '/')
    if (!normalizedFile.startsWith('templates/')) {
      return false
    }

    const baseName = path.posix.basename(normalizedFile)
    return baseName !== 'package.json' && baseName !== 'CHANGELOG.md'
  })
}
