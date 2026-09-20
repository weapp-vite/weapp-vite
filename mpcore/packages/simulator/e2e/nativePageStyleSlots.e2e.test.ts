import { expect, it } from 'vitest'

import { nextTick } from 'vue'
import { nativePageStyleSlotFiles, nativeSlotStyles, nativeSlotTemplate } from '../test/helpers/nativePageStyleSlots'
import { mountPageStyleWorkbench } from './helpers/pageStyleWorkbench'

it('preserves native layout slot state and computed dark colors while replacing and restoring light selectors', async () => {
  const preview = mountPageStyleWorkbench('inline', nativePageStyleSlotFiles())
  try {
    await nextTick()
    const session = preview.workbench.session.value!
    const page = session.getCurrentPages()[0]
    const app = session.getApp()
    expect(getComputedStyle(preview.element('#probe')).backgroundColor).toBe('rgb(243, 244, 246)')
    preview.element('#toggle').click()
    await nextTick()
    let count = 1
    for (const [name, color, expected] of [
      ['updated', '#10b981', 'rgb(16, 185, 129)'],
      ['initial', '#f3f4f6', 'rgb(243, 244, 246)'],
    ]) {
      preview.workbench.run(() => {
        const styles = nativeSlotStyles(name!, color!)
        session.files.set('global.wxss', styles)
        session.files.set('pages/shared/index.wxss', `${styles} #probe { height:100px; }`)
        session.files.set('pages/shared/index.wxml', nativeSlotTemplate(name!))
      })
      await nextTick()
      expect(preview.element('#probe').getAttribute('data-color')).toBe(name)
      expect(getComputedStyle(preview.element('#probe')).backgroundColor).toBe('rgb(16, 24, 40)')
      expect(preview.element('#toggle').textContent).toBe(String(count))
      preview.element('#toggle').click()
      await nextTick()
      expect(getComputedStyle(preview.element('#probe')).backgroundColor).toBe(expected)
      expect(preview.element('#toggle').textContent).toBe(String(++count))
      preview.element('#toggle').click()
      await nextTick()
      expect(getComputedStyle(preview.element('#probe')).backgroundColor).toBe('rgb(16, 24, 40)')
      expect(preview.element('#toggle').textContent).toBe(String(++count))
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }
    expect(preview.workbench.errorMessage.value).toBe('')
  }
  finally {
    preview.close()
  }
})
