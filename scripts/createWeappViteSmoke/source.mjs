import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'

/** 记录实际验收来源；本地旧入口未提供提交时保持未知，不推断候选身份。 */
export async function resolveSmokeSource({ source, sourceCommit, tarball, expectedTarballSha256 } = {}) {
  const resolvedSource = source?.trim() || (tarball ? 'workspace' : 'published')
  if (!['published', 'workspace'].includes(resolvedSource)) {
    throw new Error('CREATE_WEAPP_VITE_SOURCE must be published or workspace')
  }
  if ((resolvedSource === 'workspace') !== Boolean(tarball)) {
    throw new Error('Workspace smoke requires a scaffold tarball; published smoke must use the registry')
  }
  const commit = sourceCommit?.trim().toLowerCase() || null
  if (commit && !/^(?:[a-f\d]{40}|[a-f\d]{64})$/.test(commit)) {
    throw new Error('CREATE_WEAPP_VITE_SOURCE_COMMIT must be a complete Git commit')
  }
  const tarballSha256 = tarball
    ? createHash('sha256').update(await fs.readFile(tarball)).digest('hex')
    : null
  const expected = expectedTarballSha256?.trim().toLowerCase()
  if (expected && (!/^[a-f\d]{64}$/.test(expected) || expected !== tarballSha256)) {
    throw new Error('The scaffold tarball does not match CREATE_WEAPP_VITE_TARBALL_SHA256')
  }
  return { source: resolvedSource, sourceCommit: commit, tarballSha256 }
}
