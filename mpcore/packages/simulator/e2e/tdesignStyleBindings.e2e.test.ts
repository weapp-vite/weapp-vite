import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import { tdesignStyleBindingFiles, tdesignStyleProbes, tdesignStyleScenarios } from '../test/helpers/tdesignStyleBindings'
import { mountPageStyleWorkbench } from './helpers/pageStyleWorkbench'

it('renders the ten TDesign native probes through all five scenarios with supported computed styles', async () => {
  const preview = mountPageStyleWorkbench('imported', tdesignStyleBindingFiles)
  try {
    await nextTick()
    const page = preview.workbench.session.value!.getCurrentPages()[0]
    for (const state of tdesignStyleScenarios) {
      if (state.method) {
        preview.element(`#scenario-${state.id}`).click()
        await nextTick()
      }
      expect(preview.element('#scenario-state').textContent).toBe(state.id)
      const element = (key: string) => preview.element(`#class-binding-probe-${key}`)
      const style = (key: string) => getComputedStyle(element(key))
      for (const [key, title] of tdesignStyleProbes) {
        expect(element(key).textContent).toBe(title)
        expect(element(key).getBoundingClientRect().width).toBeGreaterThan(0)
        expect(element(key).getBoundingClientRect().height).toBeGreaterThan(0)
      }
      const color = state.error ? 'rgb(185, 28, 28)' : state.active ? 'rgb(255, 255, 255)' : 'rgb(31, 26, 63)'
      for (const key of ['class-static-object', 'class-reactive', 'class-array', 'class-cond-array', 'class-array-key', 'style-object']) {
        expect(style(key).color).toBe(color)
      }
      for (const key of ['class-reactive', 'class-array-key', 'style-object']) {
        expect(style(key).borderTopStyle).toBe(state.ghost ? 'dashed' : 'solid')
      }
      expect(style('class-object').color).toBe(state.active ? 'rgb(255, 255, 255)' : 'rgb(31, 26, 63)')
      expect(style('class-object').borderTopStyle).toBe('solid')
      expect(style('class-static-object').borderTopStyle).toBe('dashed')
      expect(style('style-array').opacity).toBe(state.ghost ? '0.78' : '1')
      expect(style('style-string').color).toBe(state.error ? 'rgb(185, 28, 28)' : 'rgb(31, 26, 63)')
      const accent = state.error ? 'rgb(239, 68, 68)' : 'rgb(37, 99, 235)'
      expect(style('style-var').color).toBe(accent)
      expect(style('style-var').borderTopColor).toBe(accent)
      // rpx 的原值由 unit 覆盖；计算尺寸、字体和圆角仍以真实 IDE 验收为准。
      expect(preview.workbench.session.value!.getCurrentPages()[0]).toBe(page)
      expect(preview.workbench.errorMessage.value).toBe('')
    }
  }
  finally {
    preview.close()
  }
})
