import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

export function relativeFile(file) {
  if (typeof file !== 'string' || !file || file.includes('\\') || file.startsWith('/') || /^[a-z]:/iu.test(file)
    || file.split('/').some(part => !part || part === '..' || part === '.')) {
    throw new Error('CI evidence needs normalized repository-relative file paths')
  }
  return file
}

/** 所有读取均绑定冻结 tree/blob；缓存同一 blob，避免重复 API 往返。 */
export async function immutableTree(context, get) {
  const prefix = `repos/${context.repository}/git`
  const tree = await get(`${prefix}/trees/${context.treeSha}?recursive=1`)
  if (tree.sha !== context.treeSha || tree.truncated !== false || !Array.isArray(tree.tree)) {
    throw new Error('Incomplete immutable benchmark tree')
  }
  const files = new Map()
  for (const entry of tree.tree) {
    relativeFile(entry.path)
    if (files.has(entry.path)) {
      throw new Error('Duplicated immutable benchmark tree path')
    }
    files.set(entry.path, entry)
  }
  const cached = new Map()
  const read = async (file) => {
    const entry = files.get(relativeFile(file))
    const sha = entry?.sha
    if (entry?.type !== 'blob' || !['100644', '100755'].includes(entry.mode) || !/^[a-f\d]{40}$/u.test(sha ?? '')) {
      throw new Error(`Missing immutable benchmark input: ${file}`)
    }
    if (!cached.has(sha)) {
      cached.set(sha, (async () => {
        const blob = await get(`${prefix}/blobs/${sha}`)
        const bytes = Buffer.from(blob.content ?? '', 'base64')
        const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
        if (blob.sha !== sha || blob.encoding !== 'base64' || actual !== sha) {
          throw new Error('Immutable benchmark blob identity mismatch')
        }
        return { bytes, sha }
      })())
    }
    return cached.get(sha)
  }
  return { entries: tree.tree, read }
}
