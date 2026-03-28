// eslint-disable-next-line e18e/ban-dependencies -- 当前页面回退扫描仍统一复用 fs-extra 目录遍历
import fs from 'fs-extra'
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
