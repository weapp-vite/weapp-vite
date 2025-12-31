import fs from 'fs-extra'
import path from 'pathe'

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
      else if (full.endsWith('.vue')) {
        results.push(full)
      }
    }
  }
  catch {
    // 忽略不存在的目录
  }
  return results
}
