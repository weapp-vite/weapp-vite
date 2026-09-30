import type { ProjectInfo } from '@weapp-agent/core/project'
import { createHash } from 'node:crypto'
import { readdir, readFile, readlink } from 'node:fs/promises'
import path from 'node:path'
import { safePath, sensitive } from '@weapp-agent/core/project'

const excluded = new Set(['node_modules', '.git', '.weapp-agent', '.weapp-vite', '.turbo', '.cache', '.astro', '.DS_Store', 'coverage', 'artifacts'])
/** Include untracked source/config files, without executing Git hooks or Vite config. */
export async function sourceSnapshot(project: ProjectInfo): Promise<string> {
  const hash = createHash('sha256')
  const output = path.resolve(project.root, project.outputRoot)
  const source = path.resolve(project.root, project.sourceRoot)
  let files = 0
  const walk = async (directory: string): Promise<void> => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const target = path.join(directory, entry.name)
      const relative = path.relative(project.root, target)
      if (excluded.has(entry.name) || sensitive(relative)
        || (output !== project.root && output !== source && target === output)) {
        continue
      }
      if (entry.isSymbolicLink()) {
        // A source symlink cannot be verified without following external state.
        throw new Error(`Source snapshot does not support symlinks: ${relative} -> ${await readlink(target)}`)
      }
      if (entry.isDirectory()) {
        await walk(target)
      }
      else if (entry.isFile()) {
        if (++files > 20_000) {
          throw new Error('Source snapshot exceeds 20000 files; select the mini-program package with -C.')
        }
        const bytes = await readFile(await safePath(project.root, relative))
        hash.update(JSON.stringify([relative.split(path.sep).join('/'), bytes.length]))
        hash.update(bytes)
      }
    }
  }
  await walk(project.root)
  return hash.digest('hex')
}
