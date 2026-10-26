import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { verifyStagedTypecheck } from 'repoctl'
import { stagedFiles } from './files.mjs'

/**
 * 按实际 typecheck 归属分组，避免根文件使 repoctl 合并并漏掉 package 检查。
 * @param {string[]} files 暂存文件。
 * @param {string} root 仓库根目录。
 */
export function groupTypecheckFiles(files, root) {
  /** @type {Map<string, string[]>} */
  const groups = new Map()
  for (const file of files.filter(file => /\.(?:ts|tsx|mts|cts|vue|astro|mdx)$/.test(file) || path.basename(file) === 'package.json')) {
    let current = path.dirname(path.resolve(root, file))
    while (current !== root && current.startsWith(`${root}${path.sep}`)) {
      const manifest = path.join(current, 'package.json')
      if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).scripts?.typecheck) {
        break
      }
      current = path.dirname(current)
    }
    const group = groups.get(current) ?? []
    group.push(file)
    groups.set(current, group)
  }
  return groups
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.cwd()
  for (const files of groupTypecheckFiles(stagedFiles(root), root).values()) {
    verifyStagedTypecheck(files, { cwd: root })
  }
}
