import { expect, it } from 'vitest'
import { COMPONENT_INSTANCE_API_INITIAL_TRACE, COMPONENT_INSTANCE_API_REMOVED_TRACE, COMPONENT_INSTANCE_API_RESTORED_TRACE } from '../../../../e2e/utils/componentInstanceApiContract'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentInstanceApiFiles } from '../test/helpers/componentInstanceApis'

it('renders each component selector scope and updates relations as projected children disappear', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentInstanceApiFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.snapshot()).toEqual(COMPONENT_INSTANCE_API_INITIAL_TRACE)
    render()
    expect(preview.querySelector('#parent-query')?.textContent).toBe('parent')
    expect(preview.querySelector('#child-query')?.textContent).toBe('child')
    expect(preview.querySelector('#relation-trace')?.textContent).toBe(COMPONENT_INSTANCE_API_INITIAL_TRACE.join('\n'))
    const parent = page.selectComponent?.('#parent')
    expect(parent.getRelationNodes('./child')).toHaveLength(1)
    page.removeChild()
    render()
    expect(page.snapshot()).toEqual(COMPONENT_INSTANCE_API_REMOVED_TRACE)
    render()
    expect(preview.querySelector('#child-query')).toBeNull()
    expect(preview.querySelector('#parent-query')?.textContent).toBe('parent')
    expect(parent.getRelationNodes('./child')).toHaveLength(0)
    expect(preview.querySelector('#relation-trace')?.textContent).toBe(COMPONENT_INSTANCE_API_REMOVED_TRACE.join('\n'))
    page.restoreChild()
    render()
    expect(page.snapshot()).toEqual(COMPONENT_INSTANCE_API_RESTORED_TRACE)
    render()
    expect(preview.querySelector('#child-query')?.textContent).toBe('child')
    expect(parent.getRelationNodes('./child')).toHaveLength(1)
    expect(preview.querySelector('#relation-trace')?.textContent).toBe(COMPONENT_INSTANCE_API_RESTORED_TRACE.join('\n'))
  }
  finally {
    session.close()
    preview.remove()
  }
})
