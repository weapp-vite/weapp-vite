import type { CompilerContext } from '../../context'
import type { StatefulHmrSnapshot } from './globalStyles'
import { expect, it, vi } from 'vitest'
import { clearStatefulHmrSnapshot, offerStatefulHmrSnapshot, StatefulHmrSnapshotHandoff, takeStatefulHmrSnapshot } from './snapshotHandoff'

const harness = vi.hoisted(() => ({
  hosts: new WeakMap<object, { server: object }>(),
  incoming: new WeakMap<object, StatefulHmrSnapshotHandoff>(),
}))
vi.mock('./hostPlugins', () => ({
  getStatefulHmrHost: (ctx: object) => harness.hosts.get(ctx),
}))
vi.mock('../../vite/lifecycle', () => ({
  setHostRestartData: vi.fn(),
  takeHostRestartData(server: object) {
    const handoff = harness.incoming.get(server)
    harness.incoming.delete(server)
    return handoff
  },
}))

const snapshot: StatefulHmrSnapshot = { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() }
const inputs = { scope: { roots: [], files: [], excluded: [] }, versions: new Map() }
// 这些测试只验证以编译上下文对象为键的所有权，不执行编译器服务。
const owner = () => ({} as CompilerContext)

it('takes a prepared snapshot after the same context attaches its host', async () => {
  const ctx = owner()
  const validate = vi.fn(async () => true)
  await offerStatefulHmrSnapshot(ctx, new StatefulHmrSnapshotHandoff(snapshot, inputs, validate))
  harness.hosts.set(ctx, { server: {} })
  await expect(takeStatefulHmrSnapshot(ctx)).resolves.toEqual({ snapshot, profile: undefined })
  await expect(takeStatefulHmrSnapshot(ctx)).resolves.toBeUndefined()
  expect(validate).toHaveBeenCalledOnce()
})

it('discards a prepared snapshot changed before host admission', async () => {
  const ctx = owner()
  const validate = vi.fn(async () => false)
  await offerStatefulHmrSnapshot(ctx, new StatefulHmrSnapshotHandoff(snapshot, inputs, validate))
  harness.hosts.set(ctx, { server: {} })
  await expect(takeStatefulHmrSnapshot(ctx)).resolves.toBeUndefined()
  expect(validate).toHaveBeenCalledOnce()
})

it('never returns another candidate after the inherited host snapshot is invalidated', async () => {
  const ctx = owner()
  const prepared = new StatefulHmrSnapshotHandoff(snapshot, inputs, async () => true)
  const invalidated = vi.spyOn(prepared, 'invalidate')
  await offerStatefulHmrSnapshot(ctx, prepared)
  const server = {}
  harness.hosts.set(ctx, { server })
  harness.incoming.set(server, new StatefulHmrSnapshotHandoff(snapshot, inputs, async () => false))
  await expect(takeStatefulHmrSnapshot(ctx)).resolves.toBeUndefined()
  expect(invalidated).toHaveBeenCalledOnce()
  await expect(prepared.take()).resolves.toBeUndefined()
  await expect(takeStatefulHmrSnapshot(ctx)).resolves.toBeUndefined()
})

it('clears only its own unconsumed preparation and makes cleanup idempotent', async () => {
  const first = owner()
  const second = owner()
  const prepared = new StatefulHmrSnapshotHandoff(snapshot, inputs, async () => true)
  const invalidated = vi.spyOn(prepared, 'invalidate')
  await offerStatefulHmrSnapshot(first, prepared)
  await offerStatefulHmrSnapshot(second, new StatefulHmrSnapshotHandoff(snapshot, inputs, async () => true))
  await clearStatefulHmrSnapshot(first)
  await clearStatefulHmrSnapshot(first)
  expect(invalidated).toHaveBeenCalledOnce()
  await expect(takeStatefulHmrSnapshot(first)).resolves.toBeUndefined()
  await expect(takeStatefulHmrSnapshot(second)).resolves.toEqual({ snapshot, profile: undefined })
})
