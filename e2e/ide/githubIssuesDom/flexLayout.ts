import type { TestContext } from 'vitest'
import { expect } from 'vitest'

export async function checkScopedFlexRow(context: TestContext, page: any) {
  const host = await page.$('#issue521-host', { fallback: false, timeout: 5_000 })
  const candidates = await host.$$('component', { timeout: 5_000 })
  const owners = []
  for (const candidate of candidates) {
    if ((await candidate.$$('#issue521-a', { timeout: 5_000 })).length === 1) {
      owners.push(candidate)
    }
  }
  expect(owners).toHaveLength(1)
  const rects = []
  for (const id of ['a', 'b']) {
    const item = await owners[0].$(`#issue521-${id}`, { timeout: 5_000 })
    const node = await item.$('.issue521-flex-item', { timeout: 5_000 })
    rects.push(await node.offset())
  }
  await context.annotate(JSON.stringify({ checkpoint: 'initial', route: page.path, source: 'devtools-page-frame', rects }), 'layout-evidence')
  for (const rect of rects) {
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  }
  expect(Math.abs(rects[0].top - rects[1].top)).toBeLessThanOrEqual(1)
  expect(rects[1].left).toBeGreaterThanOrEqual(rects[0].left + rects[0].width)
}
