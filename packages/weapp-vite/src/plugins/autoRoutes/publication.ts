interface PublicationSource {
  file: string
  fingerprint: string | undefined
}

/** 将路由签名和本轮源码快照一起登记，供原生 HMR 与 sidecar 消费同一发布回执。 */
export function createAutoRoutesWebPublication() {
  let signature: string | undefined
  let fingerprints = new Map<string, string>()
  return {
    get signature() {
      return signature
    },
    reset() {
      signature = undefined
      fingerprints.clear()
    },
    initialize(initialSignature: string) {
      signature ??= initialSignature
    },
    matches(nextSignature: string, sources: PublicationSource[]) {
      return signature === nextSignature && sources.length > 0 && sources.every(source => (
        source.fingerprint !== undefined && fingerprints.get(source.file) === source.fingerprint
      ))
    },
    commit(nextSignature: string, sources: PublicationSource[]) {
      signature = nextSignature
      fingerprints = new Map(sources.flatMap(source => (
        source.fingerprint === undefined ? [] : [[source.file, source.fingerprint] as const]
      )))
    },
  }
}
