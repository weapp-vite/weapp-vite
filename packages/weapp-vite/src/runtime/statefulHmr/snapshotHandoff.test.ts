import type { StatefulHmrSnapshot } from './globalStyles'
import { expect, it, vi } from 'vitest'
import { StatefulHmrSnapshotHandoff } from './snapshotHandoff'

const snapshot: StatefulHmrSnapshot = { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() }
const inputs = { scope: { roots: [], files: [], excluded: [] }, versions: new Map() }

it('hands off only once after input validation', async () => {
  const validate = vi.fn(async () => true)
  const handoff = new StatefulHmrSnapshotHandoff(snapshot, inputs, validate)
  await expect(handoff.take()).resolves.toBe(snapshot)
  await expect(handoff.take()).resolves.toBeUndefined()
  expect(validate).toHaveBeenCalledOnce()
})

it('discards changed, missing and invalidated candidates without publishing them', async () => {
  await expect(new StatefulHmrSnapshotHandoff(snapshot, inputs, async () => false).take()).resolves.toBeUndefined()
  await expect(new StatefulHmrSnapshotHandoff(snapshot).take()).resolves.toBeUndefined()
  const validated = Promise.withResolvers<boolean>()
  const handoff = new StatefulHmrSnapshotHandoff(snapshot, inputs, () => validated.promise)
  const taking = handoff.take()
  handoff.invalidate()
  handoff.invalidate()
  validated.resolve(true)
  await expect(taking).resolves.toBeUndefined()
  await expect(handoff.take()).resolves.toBeUndefined()
})
