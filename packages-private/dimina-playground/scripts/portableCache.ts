import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { root, upstreamCommit } from '../config'
import { preparationInputs, preparedRoot } from './preparation'

/** 将已校验的源码和 SDK 复制到独立快照，永不归档包管理器依赖链接。 */
export async function copyPreparedSdk(sourceCache: string, targetCache: string, projectRoot = root) {
  const source = await preparedRoot(projectRoot, sourceCache, { allowMissingDependencies: true })
  await mkdir(targetCache, { recursive: true })
  const target = await mkdtemp(path.join(targetCache, 'build-'))
  await cp(path.join(source, 'fe'), path.join(target, 'fe'), {
    recursive: true,
    filter: source => path.basename(source) !== 'node_modules',
  })
  const { fingerprint } = await preparationInputs(projectRoot)
  await writeFile(path.join(targetCache, 'ready.json'), JSON.stringify({
    commit: upstreamCommit,
    fingerprint,
    directory: path.basename(target),
  }))
  await preparedRoot(projectRoot, targetCache, { allowMissingDependencies: true })
  return target
}
