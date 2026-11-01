// @ts-expect-error Node 侧使用真实 Oxfmt 生成对照页，浏览器消费同一组文件。
import fixture from 'virtual:formatting-semantics-fixture'
import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import { FORMATTING_STEPS, formattingCheckpoints } from '../../../../e2e/utils/formattingContract'
import { mountPageStyleWorkbench } from './helpers/pageStyleWorkbench'

it('keeps formatted WXML interactions, inline whitespace and rpx selectors identical in the browser', async () => {
  const files = fixture as Array<[string, string]>
  const preview = mountPageStyleWorkbench('inline', files)
  try {
    preview.workbench.handleUpdateViewport({ width: 375, height: 812 })
    await nextTick()
    const session = preview.workbench.session.value!
    const observations: unknown[][] = []
    for (const route of ['/pages/raw/index', '/pages/formatted/index']) {
      preview.workbench.run(() => session.reLaunch(route))
      await nextTick()
      const checkpoints = formattingCheckpoints(route, false)
      const states: unknown[] = []
      for (const [index, step] of FORMATTING_STEPS.entries()) {
        if (step.target) {
          preview.element(step.target).click()
          await nextTick()
        }
        for (const node of checkpoints[index]!.nodes) {
          const root = preview.element('#fixture-root')
          const matches = root.querySelectorAll(node.selector)
          expect(matches, `${route}/${step.id}/${node.selector}`).toHaveLength(node.count ?? 1)
          if (node.text !== undefined) {
            expect(matches[0]!.textContent).toBe(node.text)
          }
        }
        const style = getComputedStyle(preview.element('#style-probe'))
        expect(style.width).toBe('60px')
        expect(style.height).toBe('20px')
        expect(style.marginLeft).toBe('4px')
        expect(style.color).toBe('rgb(12, 34, 56)')
        expect(getComputedStyle(preview.element('#item-second')).paddingLeft).toBe('5px')
        expect(getComputedStyle(preview.element('#spaces')).whiteSpace).toBe('pre-wrap')
        states.push(JSON.parse(JSON.stringify(session.getCurrentPages()[0]!.data)))
      }
      observations.push(states)
      preview.workbench.handleUpdateViewport({ width: 750, height: 812 })
      await nextTick()
      const enlargedStyle = getComputedStyle(preview.element('#style-probe'))
      expect(enlargedStyle.width).toBe('120px')
      expect(enlargedStyle.height).toBe('40px')
      expect(enlargedStyle.marginLeft).toBe('8px')
      expect(getComputedStyle(preview.element('#item-second')).paddingLeft).toBe('10px')
      preview.workbench.handleUpdateViewport({ width: 375, height: 812 })
      await nextTick()
      expect(getComputedStyle(preview.element('#style-probe')).width).toBe('60px')
    }
    expect(observations[1]).toEqual(observations[0])
    expect(preview.workbench.errorMessage.value).toBe('')
  }
  finally {
    preview.close()
  }
})
