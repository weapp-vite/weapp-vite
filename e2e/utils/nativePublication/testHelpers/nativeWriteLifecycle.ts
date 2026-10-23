import type { NativePublicationReceipt } from '../files'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationHash } from '../files'
import { nativePublicationPlugin } from '../plugin'

interface NativeWriteObservation {
  outputs: Record<string, string>
  receipts: NativePublicationReceipt[]
  settled: boolean
}

/** 只包裹真实观察钩子的生命周期，不复制源码或磁盘校验门禁。 */
export function createNativeWriteLifecycle(getOutput: () => string) {
  const plugin = nativePublicationPlugin()
  const hook = plugin.writeBundle
  if (!hook || typeof hook === 'function' || !('handler' in hook)) {
    throw new Error('Expected an ordered native publication write hook')
  }
  const handler = hook.handler
  const writes: NativeWriteObservation[] = []
  const pending = new Set<NativeWriteObservation>()
  const receipts = (value: string) => value.split('\n')
    .filter(line => line.startsWith(NATIVE_PUBLICATION_PREFIX))
    .map(line => JSON.parse(line.slice(NATIVE_PUBLICATION_PREFIX.length)) as NativePublicationReceipt)
  plugin.writeBundle = {
    ...hook,
    async handler(...args) {
      const offset = getOutput().length
      const write: NativeWriteObservation = {
        outputs: Object.fromEntries(Object.entries(args[1]).map(([file, output]) => [file, nativePublicationHash(output.type === 'chunk' ? output.code : output.source)])),
        receipts: [],
        settled: false,
      }
      writes.push(write)
      pending.add(write)
      try {
        await handler.apply(this, args)
      }
      finally {
        write.receipts = receipts(getOutput().slice(offset))
        write.settled = true
        pending.delete(write)
      }
    },
  }
  return { plugin, writes, pending, receipts: () => receipts(getOutput()) }
}
