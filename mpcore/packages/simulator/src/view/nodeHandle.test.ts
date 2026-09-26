import { parseDocument } from 'htmlparser2'
import { afterEach, expect, it, vi } from 'vitest'
import { HeadlessTestingNodeHandle } from './nodeHandle'

afterEach(() => vi.useRealTimers())

it('keeps native node queries in their declaring scope across projected component hosts', async () => {
  const document = parseDocument(`
    <page data-sim-scope="page:home">
      <view id="container" data-sim-scope="page:home">
        <host data-sim-component="host" data-sim-scope="page:home/page/host">
          <view class="private" data-sim-scope="page:home/page/host"></view>
          <text class="projected" data-sim-scope="page:home">owner text</text>
        </host>
      </view>
    </page>
  `)
  const root = new HeadlessTestingNodeHandle(document, {
    callMethod: vi.fn(),
    createPageHandle: () => ({ data: async () => ({}) }),
    createScopeHandle: () => null,
    ownerScopeId: () => null,
  })
  const page = (await root.$('page'))!
  const container = (await page.$('#container'))!
  expect(await page.$$('.private')).toHaveLength(0)
  expect(await container.$$('.private')).toHaveLength(0)
  expect(await (await container.$('.projected'))!.text()).toBe('owner text')
  const host = (await container.$('host'))!
  expect(await host.$$('.private')).toHaveLength(1)
  expect(await host.$$('.projected')).toHaveLength(0)
})

it('timestamps native interactions with the host timer clock without inventing detail', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const startedAt = Date.now()
  const callMethod = vi.fn()
  const root = new HeadlessTestingNodeHandle(parseDocument('<button id="native" bindtap="onTap">native</button>'), {
    callMethod,
    createPageHandle: () => ({ data: async () => ({}) }),
    createScopeHandle: () => null,
    ownerScopeId: () => null,
  })
  const button = await root.$('#native')
  await button!.tap()
  expect(callMethod).toHaveBeenLastCalledWith(null, 'onTap', expect.objectContaining({
    type: 'tap',
    detail: undefined,
    timeStamp: startedAt,
  }))
  vi.advanceTimersByTime(25)
  await button!.tap({ detail: { source: 'explicit' } })
  expect(callMethod).toHaveBeenLastCalledWith(null, 'onTap', expect.objectContaining({
    type: 'tap',
    detail: { source: 'explicit' },
    timeStamp: startedAt + 25,
  }))
})
