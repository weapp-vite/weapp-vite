import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { digest, repository } from '../identity'
import { ensure } from './artifacts'

async function exists(filename: string) {
  try {
    await stat(filename)
    return true
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/** 记录明确使用的 workspace helper 包源码、dist 和 manifest；不声称覆盖全部安装依赖字节。 */
export async function semanticDependencyIdentity(dependencyFiles: string[]) {
  ensure(dependencyFiles.length > 0 && new Set(dependencyFiles).size === dependencyFiles.length, 'Semantic helper dependencies are missing or duplicated')
  const roots = new Set<string>()
  const files = new Set<string>()
  for (const filename of dependencyFiles) {
    ensure(!path.isAbsolute(filename) && !filename.includes('\\') && !filename.split('/').includes('..'), 'Semantic dependency must be repository relative')
    const absolute = path.resolve(repository, filename)
    ensure((await stat(absolute)).isFile(), 'Semantic dependency is not a file')
    files.add(filename)
    let owner = path.dirname(absolute)
    while (owner !== repository && !(await exists(path.join(owner, 'package.json')))) {
      const parent = path.dirname(owner)
      ensure(parent !== owner, 'Semantic dependency has no workspace owner')
      owner = parent
    }
    ensure(owner !== repository, 'Semantic helper must belong to a workspace package')
    roots.add(path.relative(repository, owner).split(path.sep).join('/'))
  }
  const visit = async (directory: string) => {
    if (!(await exists(path.join(repository, directory)))) {
      return
    }
    for (const entry of await readdir(path.join(repository, directory), { withFileTypes: true })) {
      const filename = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await visit(filename)
      }
      else if (entry.isFile() && /\.(?:[cm]?js|ts|json)$/.test(filename) && !/\.(?:test|spec)\.[cm]?[jt]s$/.test(filename)) {
        files.add(filename)
      }
    }
  }
  for (const root of roots) {
    files.add(`${root}/package.json`)
    await visit(`${root}/src`)
    await visit(`${root}/dist`)
  }
  return {
    dependencyFiles: [...dependencyFiles].sort(),
    workspacePackageRoots: [...roots].sort(),
    hashes: Object.fromEntries(await Promise.all([...files].sort().map(async filename => [filename, digest(await readFile(path.join(repository, filename)))]))),
    scope: 'Declared helper entries plus their owning workspace src/dist JavaScript, TypeScript, JSON and manifests; installed third-party dependency bytes are not a complete closure.',
  }
}
