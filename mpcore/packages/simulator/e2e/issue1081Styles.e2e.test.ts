import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import { issue1081Styles } from '../test/helpers/issue1081Styles'
import { mountPageStyleWorkbench } from './helpers/pageStyleWorkbench'

it('applies an updated CSS Modules binding and color in the browser while preserving events and page identity', async () => {
  const preview = mountPageStyleWorkbench('imported', issue1081Styles)
  try {
    await nextTick()
    const session = preview.workbench.session.value!
    const page = session.getCurrentPages()[0]!
    const app = session.getApp()
    expect(getComputedStyle(preview.element('#module-panel')).color).toBe('rgb(17, 34, 51)')
    preview.element('#increment').click()
    await nextTick()
    preview.workbench.run(() => {
      page.setData({ moduleClass: 'panel_updated' })
      session.files.set('pages/shared/index.wxss', '.panel_updated { color: rgb(68, 85, 102); }')
    })
    await nextTick()
    expect(preview.element('#module-panel').className).toBe('panel_updated')
    expect(getComputedStyle(preview.element('#module-panel')).color).toBe('rgb(68, 85, 102)')
    expect(preview.element('#count').textContent).toBe('count: 1')
    preview.element('#increment').click()
    await nextTick()
    expect(preview.element('#count').textContent).toBe('count: 2')
    expect(session.getCurrentPages()[0]).toBe(page)
    expect(session.getApp()).toBe(app)
    expect(preview.workbench.errorMessage.value).toBe('')
  }
  finally {
    preview.close()
  }
})
