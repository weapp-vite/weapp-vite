import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'pathe'

async function walkDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  await Promise.all(entries.map(async (entry: Dirent) => {
    const filePath = path.resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkDirectory(filePath))
    }
    else if (entry.isFile()) {
      files.push(filePath)
    }
  }))
  return files.sort()
}

export async function collectQuickAppFiles(directory: string | undefined) {
  if (!directory) {
    return []
  }
  try {
    return await walkDirectory(directory)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}
