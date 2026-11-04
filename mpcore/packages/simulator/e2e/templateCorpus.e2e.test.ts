import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { createTemplateCorpusFiles, templateCorpusBindingStates, templateCorpusRoutes } from '../test/helpers/templateCorpus'

it('renders native adjacent attributes and reactive bindings in a real browser', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createTemplateCorpusFiles()) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    const output = session.renderCurrentPage()
    preview.innerHTML = output.wxml
    return new HeadlessTestingNodeHandle(output.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
  }
  try {
    const [adjacent, bindings] = templateCorpusRoutes
    session.reLaunch(adjacent)
    const probe = await render().$('#adjacent-probe')
    expect(preview.querySelector('#adjacent-probe')?.textContent).toBe('adjacent')
    expect(preview.querySelector('#adjacent-probe')?.getAttribute('data-first')).toBe('one')
    expect(preview.querySelector('#adjacent-probe')?.getAttribute('data-second')).toBe('two')
    expect(preview.querySelector('#adjacent-probe')?.getAttribute('data-empty')).toBe('')
    expect(preview.querySelector('#adjacent-result')?.textContent).toBe('pending')
    expect(probe).not.toBeNull()
    await probe!.tap()
    render()
    expect(preview.querySelector('#adjacent-result')?.textContent).toBe('one|two|string|')

    session.reLaunch(bindings)
    render()
    for (const state of templateCorpusBindingStates) {
      if (state.target) {
        await (await render().$(state.target))!.tap()
      }
      render()
      const binding = preview.querySelector('#binding-probe')
      if (state.visible) {
        expect(binding).not.toBeNull()
        expect(binding!.textContent).toBe(`${state.label}:${state.count}`)
        expect(binding!.getAttribute('class')).toBe(`visible-${state.count}`)
        expect(binding!.getAttribute('data-value')).toBe(String(state.count + 1))
        expect(binding!.getAttribute('data-label')).toBe(state.label)
      }
      else {
        expect(binding).toBeNull()
      }
      expect(preview.querySelector('#binding-state')?.textContent).toBe(`${state.visible ? 'visible' : 'hidden'}:${state.count}`)
    }
    expect(session.getCurrentPages().map(page => page.route)).toEqual([bindings.slice(1)])
  }
  finally {
    session.close()
    preview.remove()
  }
})
