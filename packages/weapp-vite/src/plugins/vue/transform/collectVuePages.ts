import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { isVueLikeFile, stripVueLikeExtension } from './shared'

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
