import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { nativeBarePropertiesFiles } from '../test/helpers/nativeBareProperties'

it('renders valueless untyped properties without converting explicit empty strings or unknown attributes', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeBarePropertiesFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  const text = (id: string) => preview.querySelector(`#${id} .bare-summary`)?.textContent
  try {
    const page = session.reLaunch('/pages/index/index')
    render()
    expect(text('bare')).toBe('boolean:true')
    expect(text('empty')).toBe('string:')
    expect(text('bound-empty')).toBe('string:')
    expect(text('null')).toBe('null')
    expect(text('undefined')).toBe('null')
    expect(text('omitted')).toBe('string:fallback')
    expect(text('true')).toBe('boolean:true')
    expect(text('false')).toBe('boolean:false')
    expect(text('included')).toBe('boolean:true')
    expect(text('behavior-bare')).toBe('boolean:true')
    expect(preview.querySelector('#behavior-bare .camel-summary')?.textContent).toBe('boolean:true')
    expect(text('behavior-bound')).toBe('string:')
    expect(preview.querySelector('#behavior-bound .camel-summary')?.textContent).toBe('boolean:true')
    expect(text('behavior-default')).toBe('string:nested-fallback')
    expect(preview.querySelector('#behavior-default .camel-summary')?.textContent).toBe('boolean:false')
    expect(preview.querySelector('#camel .camel-summary')?.textContent).toBe('boolean:true')
    expect(preview.querySelector('#unknown .unknown-summary')?.textContent).toBe('false')
    expect(preview.querySelector('#unknown')?.getAttribute('unknown')).toBe('')
    expect([...preview.querySelectorAll('.loop-probe .bare-summary')].map(node => node.textContent)).toEqual(['boolean:true', 'boolean:true'])

    page.update('changed')
    render()
    expect(text('bound-empty')).toBe('string:changed')
    expect(text('bare')).toBe('boolean:true')
    expect(text('empty')).toBe('string:')
    expect(text('behavior-bound')).toBe('string:changed')
    expect(text('behavior-bare')).toBe('boolean:true')

    page.update('')
    render()
    expect(text('bound-empty')).toBe('string:')
    expect(text('bare')).toBe('boolean:true')
    expect(text('behavior-bound')).toBe('string:')
    expect(text('behavior-default')).toBe('string:nested-fallback')
  }
  finally {
    session.close()
    preview.remove()
  }
})
