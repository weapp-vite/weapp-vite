import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import path from 'pathe'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')

/** 与现有 issue1015Project 使用同样的临时工程和 workspace 包链接边界。 */
export async function createSequenceProject() {
  const parent = path.join(repositoryRoot, '.tmp/edit-sequence')
  await mkdir(parent, { recursive: true })
  const root = await realpath(await mkdtemp(path.join(parent, 'fixture-')))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(await realpath(path.join(repositoryRoot, 'packages-runtime/wevu')), path.join(root, 'node_modules/wevu'), 'junction')
  return { root, close: () => rm(root, { recursive: true, force: true }) }
}
