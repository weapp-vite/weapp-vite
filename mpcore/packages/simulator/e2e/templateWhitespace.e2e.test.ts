import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { templateWhitespaceChecks, templateWhitespaceFiles, templateWhitespaceStates } from '../test/helpers/templateWhitespace'

it('renders formatted dynamic islands without adding indentation to their visible text', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(templateWhitespaceFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    for (const count of [0, 1]) {
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#island')?.textContent).toBe(`dynamic island: ${count}`)
      expect(preview.querySelector('#explicit')?.textContent).toBe('  spaced  ')
      page.increment()
    }
    const whitespacePage = session.reLaunch('/pages/whitespace/index')
    for (const space of templateWhitespaceStates) {
      whitespacePage.setData({ space })
      preview.innerHTML = session.renderCurrentPage().wxml
      for (const [selector, text] of templateWhitespaceChecks(space)) {
        expect(preview.querySelector(selector)?.textContent, `${selector}/${JSON.stringify(space)}`).toBe(text)
      }
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
