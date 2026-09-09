import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { styleBindingFiles } from '../test/helpers/styleBindings'

it('updates rendered class, color and responsive style attributes together', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(styleBindingFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const probe = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
    const element = preview.querySelector<HTMLElement>('#style-probe')
    expect(element).not.toBeNull()
    return element!
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    let element = probe()
    expect(element.textContent).toBe('Base')
    expect(getComputedStyle(element).color).toBe('rgb(31, 26, 63)')
    expect(element.getAttribute('style')).toContain('border-radius:18rpx;font-size:24rpx;')
    page.activate()
    element = probe()
    expect(element.className).toBe('probe active ghost')
    expect(element.textContent).toBe('All On')
    expect(getComputedStyle(element).color).toBe('rgb(185, 28, 28)')
    expect(element.getAttribute('style')).toContain('border-radius:999rpx;font-size:26rpx;')
    page.reset()
    element = probe()
    expect(element.className).toBe('probe')
    expect(element.textContent).toBe('Base')
    expect(getComputedStyle(element).color).toBe('rgb(31, 26, 63)')
    expect(element.getAttribute('style')).toContain('border-radius:18rpx;font-size:24rpx;')
  }
  finally {
    session.close()
    preview.remove()
  }
})
