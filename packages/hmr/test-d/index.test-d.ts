import type { HmrAsset, HmrAssetChanges, HmrCompilerPreparation, HmrCompilerRequest } from '@weapp-vite/hmr'
import { captureHmrBatch, HmrAssetStore, HmrCompilerHost, HmrTransaction, transformHmrBatch } from '@weapp-vite/hmr'
import { expectAssignable, expectType } from 'tsd'

export async function verifyPublicTypes() {
  const input: HmrCompilerRequest = { revision: 1, changedFiles: ['page.tsx'], sources: new Map([['page.tsx', 'source']]) }
  expectType<ReadonlyMap<string, string | null>>(input.sources)
  const host = new HmrCompilerHost({ sourceId: id => id, hasVisualChange: (_id, previous, current) => previous !== current })
  expectAssignable<HmrCompilerRequest>(host.freeze(['page.tsx']))
  const provider: HmrCompilerPreparation = { assets: [{ fileName: 'app.wxss', code: '.card{}' }] }
  const batch = { origin: 'native' as const, changedFiles: ['page.tsx'], updates: [{ clientId: 'taro', update: { type: 'Patch', code: 'code', filename: 'same.js', seq: 4 } }] }
  expectType<'native'>(captureHmrBatch(batch).origin)
  const transformed = await transformHmrBatch(batch, [provider], { sourcemap: true })
  expectType<number>(transformed.updates[0]!.update.seq)
  expectType<'native'>(transformed.origin)
  const state = new HmrAssetStore()
  expectType<Promise<HmrAssetChanges<HmrAsset>>>(state.commit([], async () => {}))
  expectType<Promise<HmrAssetChanges<HmrAsset>>>(state.commit([], async () => {}, ['host-chunk.js']))
  const transaction = new HmrTransaction({ identity: { generation: 'build', revision: 1 }, prepare: () => 1, commit: async () => {}, publish: async () => {} })
  expectType<boolean>(transaction.acknowledge({ generation: 'build', revision: 1 }))
}
