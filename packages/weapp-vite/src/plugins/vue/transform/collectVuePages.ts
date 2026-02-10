import fs from 'fs-extra'
import path from 'pathe'

const VUE_LIKE_EXTENSIONS = ['.vue', '.tsx', '.jsx'] as const

function isVueLikeFile(file: string) {
  return VUE_LIKE_EXTENSIONS.some(ext => file.endsWith(ext))
}

function stripVueLikeExtension(file: string) {
  for (const ext of VUE_LIKE_EXTENSIONS) {
    if (file.endsWith(ext)) {
      return file.slice(0, -ext.length)
    }
  }
  return file
}

export async function collectVuePages(root: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(root)
    for (const entry of entries) {
      const full = path.join(root, entry)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        const nested = await collectVuePages(full)
        results.push(...nested)
      }
      else if (isVueLikeFile(full)) {
        results.push(stripVueLikeExtension(full))
      }
    }
  }
  catch {
    // 忽略不存在的目录
  }
  return results
}
