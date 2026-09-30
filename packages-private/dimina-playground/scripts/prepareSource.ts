/* eslint-disable e18e/ban-dependencies -- 使用跨平台 git 子进程隔离上游源码。 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'

export async function prepareSource(source: string, cache: string, commit: string, patches: string[]) {
  const directory = await mkdtemp(path.join(cache, 'build-'))
  const git = (args: string[]) => execa('git', args, { cwd: directory })
  await git(['clone', '--shared', '--no-checkout', source, directory])
  await git(['checkout', '--detach', commit])
  for (const patch of patches) {
    await git(['apply', '--check', patch])
    await git(['apply', '--index', patch])
  }
  return directory
}

export async function prepareInstallation(
  options: { source: string, cache: string, commit: string, patches: string[], fingerprint: string },
  build: (directory: string) => Promise<void>,
) {
  const { source, cache, commit, patches, fingerprint } = options
  const marker = path.join(cache, 'ready.json')
  await rm(marker, { force: true })
  const directory = await prepareSource(source, cache, commit, patches)
  await build(directory)
  await writeFile(marker, `${JSON.stringify({ commit, fingerprint, directory: path.basename(directory) })}\n`)
  return directory
}
