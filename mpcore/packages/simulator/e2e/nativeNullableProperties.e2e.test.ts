import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { nativeNullablePropertiesFiles } from '../test/helpers/nativeNullableProperties'

it('renders an explicit untyped null without falling back to the omitted property default', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeNullablePropertiesFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    render()
    expect(preview.querySelector('#omitted .nullable-summary')?.textContent).toBe('string:fallback')
    expect(preview.querySelector('#explicit .nullable-summary')?.textContent).toBe('null')
    expect(preview.querySelector('#bound-undefined .nullable-summary')?.textContent).toBe('null')

    page.update('next')
    render()
    expect(preview.querySelector('#explicit .nullable-summary')?.textContent).toBe('string:next')

    page.update(null)
    render()
    expect(preview.querySelector('#explicit .nullable-summary')?.textContent).toBe('null')
    expect(preview.querySelector('#explicit')?.textContent).not.toContain('next')
    expect(preview.querySelector('#explicit')?.textContent).not.toContain('fallback')
    expect(preview.querySelector('#omitted .nullable-summary')?.textContent).toBe('string:fallback')

    page.update(42)
    render()
    expect(preview.querySelector('#explicit .nullable-summary')?.textContent).toBe('number:42')

    page.includeBound(true)
    render()
    expect(preview.querySelector('#bound-undefined .nullable-summary')?.textContent).toBe('number:42')
    page.includeBound(false)
    render()
    expect(preview.querySelector('#bound-undefined .nullable-summary')?.textContent).toBe('null')
    expect(preview.querySelector('#bound-undefined')?.textContent).not.toContain('42')
    expect(preview.querySelector('#omitted .nullable-summary')?.textContent).toBe('string:fallback')
  }
  finally {
    session.close()
    preview.remove()
  }
})
