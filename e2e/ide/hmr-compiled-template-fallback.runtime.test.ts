import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { templateFallbackCheckpoints } from './statefulHmrDom/templateFallback'
import { createTemplateFallbackSession } from './statefulHmrDom/templateFallbackSession'

describe('compiled template registration classic fallback', { concurrent: false }, () => {
  const session = createTemplateFallbackSession(false)
  beforeAll(() => session.start(), 180_000)
  afterAll(() => session.close(), 120_000)

  it('reloads mixed Wevu template, script, defaults and styles through sticky classic', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', templateFallbackCheckpoints('mixed', resolveRuntimeProviderName()))
    const check = async (id: string) => dom.check(id, session.miniProgram, await session.miniProgram.currentPage())
    await session.begin()
    await check('initial')
    await session.prepare()
    await check('prepared')

    const template = session.original.replace('<input', '<view class="sfc-template">SFC-TEMPLATE-B</view>\n    <input')
    await session.save(template)
    await check('template-b')
    await session.save(session.original)
    await check('template-a')

    const mixed = session.original
      .replace('<input', '<view class="sfc-template">SFC-MIXED-TEMPLATE</view>\n    <input')
      .replace('STATEFUL-WEVU-BASE', 'STATEFUL-WEVU-PATCHED')
      .replace('count.value += 1', 'count.value += 2')
      .replace('store.increment(1)', 'store.increment(2)')
      .replace('  removed: \'initial\',', '  removed: \'initial\',\n  added: \'new default\',')
    await session.save(mixed, 'STATEFUL-WEVU-PATCHED')
    await check('patched')
    await session.tap()
    await expect.poll(session.state).toMatchObject({ count: 2, storeCount: 2 })
    await check('updated')

    const styled = mixed
      .replace('count.value += 2', 'count.value += 3')
      .replace('store.increment(2)', 'store.increment(3)')
      .replace('.page {', '.page {\n  background-color: #dbeafe;')
    await session.save(styled, 'STATEFUL-WEVU-PATCHED')
    await check('mixed-style')
    await session.tap()
    await expect.poll(session.state).toMatchObject({ count: 3, storeCount: 3 })
    await check('mixed-style-updated')
    await session.save(session.original)
    await check('restored')
    await session.tap()
    await expect.poll(session.state).toMatchObject({ count: 1, storeCount: 1 })
    await check('original-clicked')
  }, 600_000)

  it('reloads Wevu computed bindings and inline events and restores original interactions in classic', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', templateFallbackCheckpoints('bindings', resolveRuntimeProviderName()))
    const check = async (id: string) => dom.check(id, session.miniProgram, await session.miniProgram.currentPage())
    await session.begin()
    await check('initial')
    await session.prepare()
    await check('prepared')
    const edited = session.original.replace('<input', '<view class="derived-count">{{ count * 10 + 1 }}</view>\n    <button class="derived-increment" @tap="count += 2">advance</button>\n    <input')
    await session.save(edited)
    await check('edited')
    await session.tap('.derived-increment')
    await expect.poll(session.state).toMatchObject({ count: 2, storeCount: 0 })
    await check('clicked')
    await session.save(session.original)
    await check('restored')
    await session.tap()
    await expect.poll(session.state).toMatchObject({ count: 1, storeCount: 1 })
    await check('original-clicked')
  }, 300_000)

  it('keeps classic across two Wevu template edit and restore cycles', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', templateFallbackCheckpoints('cycles', resolveRuntimeProviderName()))
    const check = async (id: string) => dom.check(id, session.miniProgram, await session.miniProgram.currentPage())
    await session.begin()
    await check('initial')
    await session.prepare()
    await check('prepared')
    for (const cycle of [0, 1]) {
      await session.save(session.original.replace('<input', `<view class="template-cycle">TEMPLATE-CYCLE-${cycle}</view>\n    <input`))
      await check(`edit-${cycle}`)
      await session.save(session.original)
      await check(`restore-${cycle}`)
    }
  }, 400_000)
})

describe('external compiled template registration classic fallback', { concurrent: false }, () => {
  const session = createTemplateFallbackSession(true)
  beforeAll(() => session.start(), 180_000)
  afterAll(() => session.close(), 120_000)

  it('falls back from explicit stateful for external template src and restores computed bindings and events', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', templateFallbackCheckpoints('external', resolveRuntimeProviderName()))
    const check = async (id: string) => dom.check(id, session.miniProgram, await session.miniProgram.currentPage())
    await session.begin()
    await check('initial')
    await session.prepare()
    await check('prepared')
    const edited = session.original.replace('<input', '<view class="sfc-template">EXTERNAL-TEMPLATE</view>\n    <view class="derived-count">{{ count * 10 + 1 }}</view>\n    <button class="derived-increment" @tap="count += 2">advance</button>\n    <input')
    await session.save(edited)
    await check('edited')
    await session.tap('.derived-increment')
    await expect.poll(session.state).toMatchObject({ count: 2, storeCount: 0 })
    await check('clicked')
    await session.save(session.original)
    await check('restored')
    await session.tap()
    await expect.poll(session.state).toMatchObject({ count: 1, storeCount: 1 })
    await check('original-clicked')
  }, 300_000)
})

describe('cached scoped-slot classic publication', { concurrent: false }, () => {
  const session = createTemplateFallbackSession(false, { scopedSlots: true })
  beforeAll(() => session.start(), 180_000)
  afterAll(() => session.close(), 120_000)

  it('keeps scoped-slot scripts, rendered bindings and interactions across classic edit and restore generations', async (ctx) => {
    const stages = [
      ['initial', 0, null],
      ['prepared', 2, null],
      ['edit-0', 0, 'SLOT-CYCLE-0'],
      ['clicked-0', 1, 'SLOT-CYCLE-0'],
      ['restore-0', 0, null],
      ['edit-1', 0, 'SLOT-CYCLE-1'],
      ['clicked-1', 1, 'SLOT-CYCLE-1'],
      ['restore-1', 0, null],
    ] as const
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', stages.map(([id, count, templateCycle]) => ({
      id,
      route: '/pages/wevu/index',
      action: `检查 ${id} 的 scoped-slot 依赖、真实节点与父页面状态`,
      nodes: [
        { selector: '.count', text: String(count) },
        { selector: '.scoped-value', scope: ['#scoped-host', { has: '.scoped-value' }], text: `SLOT-READY:${count}` },
        templateCycle === null
          ? { selector: '.template-cycle', count: 0 }
          : { selector: '.template-cycle', text: templateCycle },
      ],
    })))
    const check = async (id: string) => {
      try {
        await dom.check(id, session.miniProgram, await session.miniProgram.currentPage())
      }
      catch (error) {
        await session.diagnoseScopedSlot(`failed-${id}`)
        throw error
      }
    }
    await session.begin()
    await check('initial')
    await session.prepare()
    await check('prepared')
    for (const cycle of [0, 1]) {
      await session.save(session.original.replace('<input', `<view class="template-cycle">SLOT-CYCLE-${cycle}</view>\n    <input`))
      await check(`edit-${cycle}`)
      await session.tap()
      try {
        await expect.poll(session.state).toMatchObject({ count: 1, storeCount: 1 })
      }
      catch (error) {
        await session.diagnoseScopedSlot(`failed-click-${cycle}`)
        throw error
      }
      await check(`clicked-${cycle}`)
      await session.save(session.original)
      await check(`restore-${cycle}`)
    }
  }, 400_000)
})
