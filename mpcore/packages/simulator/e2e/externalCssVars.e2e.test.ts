import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import { externalCssVarsFiles, externalCssVarsSteps } from '../test/helpers/externalCssVars'
import { mountPageStyleWorkbench } from './helpers/pageStyleWorkbench'

it('applies all seven external CSS updates to visible colors without losing page or app state', async () => {
  const preview = mountPageStyleWorkbench('imported', externalCssVarsFiles)
  try {
    await nextTick()
    const session = preview.workbench.session.value!
    const page = session.getCurrentPages()[0]!
    const app = session.getApp()
    preview.element('#increment').click()
    await nextTick()
    for (const step of externalCssVarsSteps) {
      preview.workbench.run(() => {
        session.files.set('pages/shared/index.wxss', `@import "../../styles/${step.file}.wxss";`)
        session.files.set(`styles/${step.file}.wxss`, `#external-vars { ${step.css}; }`)
        page.setData({ vars: step.vars, state: step.id })
      })
      await nextTick()
      const element = preview.element('#external-vars')
      expect(element.textContent).toBe(step.id)
      expect(getComputedStyle(element).color).toBe(step.color)
      expect(getComputedStyle(element).backgroundColor).toBe(step.background)
      expect(preview.element('#increment').textContent).toBe('1')
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
      expect(preview.workbench.errorMessage.value).toBe('')
    }
    preview.element('#increment').click()
    await nextTick()
    expect(preview.element('#increment').textContent).toBe('2')
  }
  finally {
    preview.close()
  }
})
