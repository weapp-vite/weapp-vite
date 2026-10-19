import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { hasVerificationSourceChanges } from '../verification/generatedEvidence.ts'
import { frameworkInputPolicy, frameworkInputs } from './ci/inputs.mjs'

export const LOCAL_FRAMEWORK_INPUT_POLICY = frameworkInputPolicy.version

function sourceIdentity(git) {
  const commitSha = git(['rev-parse', 'HEAD']).toString('utf8').trim()
  const treeSha = git(['rev-parse', `${commitSha}^{tree}`]).toString('utf8').trim()
  assert(/^[a-f\d]{40}$/u.test(commitSha) && /^[a-f\d]{40}$/u.test(treeSha), 'Local framework snapshot requires known SHA-1 Git objects')
  assert(!hasVerificationSourceChanges(
    git(['status', '--porcelain', '--untracked-files=no']).toString('utf8'),
    git(['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8'),
  ), 'Local framework snapshot requires a clean known checkout')
  return { commitSha, treeSha, sourceFingerprint: createHash('sha256').update(JSON.stringify([commitSha, treeSha])).digest('hex') }
}

/** 本地与 CI 使用同一完整输入策略；普通文件绑定 tree SHA，仅投影 JSON 按身份读取 blob。 */
export async function localFrameworkInputs(root) {
  root = await realpath(root)
  const git = args => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 ** 2 })
  const before = sourceIdentity(git)
  const output = git(['ls-tree', '-r', '-z', '--full-tree', before.treeSha]).toString('utf8')
  assert(output.endsWith('\0'), 'Incomplete local framework tree')
  const entries = output.slice(0, -1).split('\0').map((line) => {
    const match = /^(\d{6}) (blob|commit) ([a-f\d]{40})\t([\s\S]+)$/u.exec(line)
    assert(match, 'Invalid local framework tree entry')
    return { mode: match[1], type: match[2], sha: match[3], path: match[4] }
  })
  const files = new Map(entries.map(entry => [entry.path, entry]))
  const cached = new Map()
  const read = async (file) => {
    const entry = files.get(file)
    assert(entry?.type === 'blob', 'Missing local framework blob')
    if (!cached.has(entry.sha)) {
      const bytes = git(['cat-file', 'blob', entry.sha])
      const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
      assert(sha === entry.sha, 'Local framework blob identity mismatch')
      cached.set(sha, { bytes, sha })
    }
    return cached.get(entry.sha)
  }
  const inputs = await frameworkInputs(entries, read)
  assert.deepEqual(sourceIdentity(git), before, 'Source changed while freezing local framework inputs')
  return { ...before, ...inputs }
}
