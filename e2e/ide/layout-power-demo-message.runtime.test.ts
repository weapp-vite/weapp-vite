import type { LayoutPowerSession } from './layoutPowerDom/session'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { feedbackRoundCheckpoints, INDEX_ROUTE, LAYOUT_POWER_FIXTURE, layoutStateCheckpoint, runFeedbackRounds } from './layoutPowerDom/feedback'
import { prepareLayoutPowerSession, startLayoutPowerSession } from './layoutPowerDom/session'

const TD_MESSAGE_DUPLICATE_SLOT_RE = /More than one slot named .*tdesign-miniprogram\/message\/message/

describe('layout-power-demo message feedback in real WeChat DevTools', { concurrent: false }, () => {
  let session: LayoutPowerSession | undefined

  beforeAll(prepareLayoutPowerSession, 60_000)
  afterAll(async () => {
    await session?.close()
  }, 60_000)

  it('keeps repeated message taps stable after layout switches', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, LAYOUT_POWER_FIXTURE, [
      layoutStateCheckpoint('initial', '启动后检查默认布局、页面内容和交互计数', 'default', 1),
      ...feedbackRoundCheckpoints('repeat', 5),
    ])
    session = await startLayoutPowerSession()
    const { miniProgram, collector } = session
    const page = await miniProgram.reLaunch(INDEX_ROUTE)
    await acceptance.check('initial', miniProgram, page)
    expect(await page.callMethod('runE2E')).toMatchObject({ ok: true, marker: 'runtime-vendor-hmr-baseline' })
    await runFeedbackRounds(acceptance, miniProgram, page, 'repeat', 5)
    expect(await page.data('runtimeEvents')).toBe(25)
    expect(collector.getSince(0)).toEqual([])
    expect(collector.getLogsSince(0)).not.toEqual(expect.arrayContaining([expect.stringMatching(TD_MESSAGE_DUPLICATE_SLOT_RE)]))
  }, 480_000)
})
