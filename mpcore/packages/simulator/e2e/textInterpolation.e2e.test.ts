import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { textInterpolationFiles } from '../test/helpers/textInterpolation'

it('renders null text on initial paint and after updates without changing missing bindings', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(textInterpolationFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    render()
    expect(preview.querySelector('#direct')?.textContent).toBe('null')
    expect(preview.querySelector('#mixed')?.textContent).toBe('value=null;missing=')
    expect(preview.querySelector('#missing')?.textContent).toBe('')
    expect(preview.querySelector('#nested')?.textContent).toBe('null')
    expect(preview.querySelector('#attributes')?.getAttribute('data-value')).toBe('')

    page.setData({ value: 42 })
    render()
    expect(preview.querySelector('#direct')?.textContent).toBe('42')
    page.setData({ value: null })
    render()
    expect(preview.querySelector('#direct')?.textContent).toBe('null')
    expect(preview.querySelector('#mixed')?.textContent).toBe('value=null;missing=')
    page.setData({ value: 'restored' })
    render()
    expect(preview.querySelector('#direct')?.textContent).toBe('restored')
  }
  finally {
    session.close()
    preview.remove()
  }
})
