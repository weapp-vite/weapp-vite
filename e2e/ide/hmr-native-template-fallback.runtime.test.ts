import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { nativeDefaultCheckpoints } from './statefulHmrDom/nativeDefaults'
import { createTemplateFallbackSession } from './statefulHmrDom/templateFallbackSession'
import { templateCycleCheckpoints } from './statefulHmrDom/templates'

for (const runtime of ['native', 'component'] as const) {
  describe(`${runtime} template publication classic fallback`, { concurrent: false }, () => {
    const session = createTemplateFallbackSession(false, { runtime })
    beforeAll(() => session.start(), 180_000)
    afterAll(() => session.close(), 120_000)

    it('reloads the first template edit and both restoration cycles, then keeps interactions working', async (ctx) => {
      const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', [
        ...templateCycleCheckpoints(runtime),
        { id: 'clicked', route: `/pages/${runtime}/index`, action: '完整重载后原始事件仍可用', nodes: [{ selector: '.count', text: '1' }] },
      ])
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
      await session.tap()
      await check('clicked')
    }, 400_000)

    it('publishes new script defaults after template reloads and resets them on restoration', async (ctx) => {
      const defaults = [
        ['new-defaults', 7],
        ['incremented', 8],
        ['active-restored', 0],
        ['restored-defaults', 0],
      ].map(([id, count]) => ({
        id: String(id),
        route: `/pages/${runtime}/index`,
        action: `${id}：验证 classic 默认值、点击和撤销`,
        nodes: [{ selector: '.count', text: String(count) }, { selector: '.marker', text: `STATEFUL-${runtime.toUpperCase()}-BASE` }],
      }))
      const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', runtime === 'native' ? nativeDefaultCheckpoints() : defaults)
      const check = async (id: string) => dom.check(id, session.miniProgram, await session.miniProgram.currentPage())
      const original = await fs.readFile(session.scriptFile, 'utf8')
      try {
        if (runtime === 'native') {
          for (const target of ['native', 'component']) {
            const templateFile = path.resolve(session.scriptFile, `../../${target}/index.wxml`)
            const template = await fs.readFile(templateFile, 'utf8')
            try {
              await session.save(template.replace('<input', '<view class="default-template">changed</view><input'), undefined, templateFile)
              await session.miniProgram.reLaunch(`/pages/${target}/index?source=defaults`)
              await check(`${target}-edited`)
              await session.save(template, undefined, templateFile)
              await session.miniProgram.reLaunch(`/pages/${target}/index?source=defaults`)
              await check(`${target}-restored`)
            }
            finally {
              if (await fs.readFile(templateFile, 'utf8') !== template) {
                await session.save(template, undefined, templateFile)
              }
            }
          }
        }
        await session.save(original.replace('count: 0', 'count: 7'), undefined, session.scriptFile, 7)
        await check('new-defaults')
        await session.tap()
        await check('incremented')
        await session.save(original, undefined, session.scriptFile)
        await check('active-restored')
        await session.begin()
        await check('restored-defaults')
      }
      finally {
        if (await fs.readFile(session.scriptFile, 'utf8') !== original) {
          await session.save(original, undefined, session.scriptFile)
        }
      }
      expect((await session.state()).statefulKeys).toEqual([false, false, false])
    }, 300_000)
  })
}
