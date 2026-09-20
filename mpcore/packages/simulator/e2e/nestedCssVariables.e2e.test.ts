import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { nestedCssVariableFiles, nestedCssVariableStyle } from '../test/helpers/nestedCssVariables'

it('renders nested CSS fallbacks, gradients and dynamic overrides in the browser', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nestedCssVariableFiles) })
  const preview = document.createElement('div')
  const shadow = preview.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = nestedCssVariableStyle
  const content = document.createElement('div')
  shadow.append(style, content)
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/css-nested-vars/index')
    for (const state of ['initial', 'updated', 'initial']) {
      content.innerHTML = session.renderCurrentPage().wxml
      const nested = content.querySelector<HTMLElement>('#vars-nested')!
      const flat = content.querySelector<HTMLElement>('#vars-flat')!
      const gradient = content.querySelector<HTMLElement>('#vars-gradient')!
      expect(content.querySelector('#vars-state')?.textContent).toBe(state)
      expect(nested.textContent).toBe('Nested fallback')
      expect(getComputedStyle(flat).lineHeight).toBe('28px')
      expect(getComputedStyle(nested).lineHeight).toBe(state === 'updated' ? '40px' : '28px')
      expect(getComputedStyle(nested).borderRadius).toBe(state === 'updated' ? '12px' : '8px')
      for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'] as const) {
        expect(getComputedStyle(nested)[corner]).toBe(state === 'updated' ? '12px' : '8px')
      }
      expect(nested.getBoundingClientRect().height).toBe(state === 'updated' ? 40 : 28)
      expect(nested.getBoundingClientRect().width).toBe(280)
      expect(getComputedStyle(gradient).backgroundImage).toBe(state === 'updated'
        ? 'linear-gradient(to right, rgb(239, 68, 68), rgb(59, 130, 246))'
        : 'linear-gradient(to right, rgb(5, 223, 114), rgb(0, 187, 253))')
      expect(gradient.getBoundingClientRect().height).toBe(50)
      const toggle = content.querySelector<HTMLButtonElement>('#vars-toggle')!
      toggle.addEventListener('click', () => page.toggle(), { once: true })
      toggle.click()
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
