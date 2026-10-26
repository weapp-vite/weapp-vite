import type { RuntimeState } from '../../runtime/runtimeState'

interface AutoRoutesWebSourceSnapshot {
  readonly signature: string
  readonly fingerprints: ReadonlyMap<string, string>
}

/** 同步复制服务已接受的完整扫描结果，避免监听文件子集遗漏外部模板、样式或跨批次移动后的源码。 */
export function createAutoRoutesWebSourceSnapshot(
  state: Pick<RuntimeState['autoRoutes'], 'signature' | 'pageDeclarationFingerprints'>,
): AutoRoutesWebSourceSnapshot {
  return {
    signature: state.signature,
    fingerprints: new Map(state.pageDeclarationFingerprints),
  }
}

/** 将完整扫描快照登记为发布回执，供原生 HMR 与 sidecar 消费同一代源码。 */
export function createAutoRoutesWebPublication() {
  let published: AutoRoutesWebSourceSnapshot | undefined
  const commit = (snapshot: AutoRoutesWebSourceSnapshot) => {
    published = {
      signature: snapshot.signature,
      fingerprints: new Map(snapshot.fingerprints),
    }
  }
  return {
    get signature() {
      return published?.signature
    },
    reset() {
      published = undefined
    },
    initialize(snapshot: AutoRoutesWebSourceSnapshot) {
      if (!published) {
        commit(snapshot)
      }
    },
    matches(snapshot: AutoRoutesWebSourceSnapshot) {
      const previous = published
      if (!previous || previous.signature !== snapshot.signature || previous.fingerprints.size !== snapshot.fingerprints.size) {
        return false
      }
      return [...snapshot.fingerprints].every(([file, fingerprint]) => (
        previous.fingerprints.get(file) === fingerprint
      ))
    },
    commit,
  }
}
