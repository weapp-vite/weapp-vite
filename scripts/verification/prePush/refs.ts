export interface PushRef {
  localRef: string
  localSha: string
  remoteRef: string
  remoteSha: string
}

export interface PushTarget extends PushRef {
  head: string
  tree: string
  base: string | null
}

export type GitReader = (args: string[]) => Promise<string>

const SHA = /^(?:[a-f\d]{40}|[a-f\d]{64})$/
const ZERO = /^0+$/

/** 读取 Git 原生四列输入；删除引用不执行候选代码，格式损坏则拒绝推送。 */
export function parsePushRefs(input: string): PushRef[] {
  if (input.length > 1024 * 1024) {
    throw new Error('pre-push 引用输入超出上限')
  }
  const refs = input.split(/\r?\n/).filter(Boolean).map((line) => {
    const fields = line.split(' ')
    if (fields.length !== 4 || fields.some(field => !field || /[\s\0]/.test(field))) {
      throw new Error('pre-push 必须接收 Git 原生的四列引用输入')
    }
    const [localRef, localSha, remoteRef, remoteSha] = fields as [string, string, string, string]
    if (!SHA.test(localSha) || !SHA.test(remoteSha) || localSha.length !== remoteSha.length
      || !remoteRef.startsWith('refs/') || (localRef === '(delete)' && !ZERO.test(localSha))) {
      throw new Error('pre-push 引用或提交身份无效')
    }
    return { localRef, localSha, remoteRef, remoteSha }
  })
  if (new Set(refs.map(ref => ref.remoteRef)).size !== refs.length) {
    throw new Error('pre-push 包含重复的远端引用')
  }
  return refs
}

async function commit(git: GitReader, ref: string): Promise<string | null> {
  try {
    const result = (await git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])).trim()
    if (!SHA.test(result)) {
      throw new Error('Git 返回了无效的提交身份')
    }
    return result
  }
  catch {
    return null
  }
}

/** 更新使用广告中的真实旧提交；新引用使用主线共同祖先，缺失对象回退完整范围。 */
export async function resolvePushTargets(refs: PushRef[], git: GitReader, fallbackBase = 'origin/main'): Promise<PushTarget[]> {
  const targets: PushTarget[] = []
  for (const ref of refs) {
    if (ZERO.test(ref.localSha) || ref.localSha === ref.remoteSha) {
      continue
    }
    const head = await commit(git, ref.localSha)
    if (!head) {
      throw new Error(`待推引用无法解析为本地提交: ${ref.localRef}`)
    }
    let base = ZERO.test(ref.remoteSha) ? null : await commit(git, ref.remoteSha)
    if (ZERO.test(ref.remoteSha)) {
      const baseline = await commit(git, fallbackBase)
      if (baseline) {
        try {
          base = (await git(['merge-base', head, baseline])).trim()
          if (!SHA.test(base)) {
            throw new Error('Git 返回了无效的共同祖先')
          }
        }
        catch {
          base = null
        }
      }
    }
    const tree = (await git(['rev-parse', `${head}^{tree}`])).trim()
    if (!SHA.test(tree)) {
      throw new Error('Git 返回了无效的候选 tree')
    }
    targets.push({ ...ref, head, tree, base })
  }
  return targets
}
