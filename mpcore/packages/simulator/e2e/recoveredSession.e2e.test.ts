import { expect, it } from 'vitest'
import { createRecoveredSessionFixture } from '../test/helpers/recoveredSession'

it('renders and interacts with the replacement runtime through a retained session reference', () => {
  const fixture = createRecoveredSessionFixture()
  const session = fixture.session
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  const tap = () => {
    const button = preview.querySelector('#counter')!
    session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, {})
    render()
  }
  try {
    session.reLaunch('/pages/index/index')
    render()
    tap()
    expect(preview.textContent).toBe('count:1')
    fixture.recover()
    session.reLaunch('/pages/index/index')
    render()
    expect(preview.textContent).toBe('count:0')
    tap()
    expect(preview.textContent).toBe('count:1')
    session.navigateTo('/pages/result/index')
    render()
    expect(preview.querySelector('#result')?.textContent).toBe('ready:true')
  }
  finally {
    fixture.close()
    preview.remove()
  }
})
