import type { NativeSelectorAttachmentSnapshot } from '../test/helpers/nativeSelectorAttachment'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { nativeSelectorAttachmentFiles, nativeSelectorAttachmentLeafIds } from '../test/helpers/nativeSelectorAttachment'
import { assertNativeSelectorAttachment } from '../test/helpers/selectorAttachmentAssertions'

it('preserves native attached query order and own-root geometry across slot projection in the browser', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeSelectorAttachmentFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    const read = () => page.snapshot() as NativeSelectorAttachmentSnapshot
    const phases: Array<{ phase: string, open: boolean }> = []
    const observe = async (phase: string, open: boolean) => {
      await expect.poll(() => {
        const snapshot = read()
        return nativeSelectorAttachmentLeafIds.every(id =>
          snapshot.leaves[id]?.queries.some(query => query.phase === phase),
        )
      }).toBe(true)
      phases.push({ phase, open })
      assertNativeSelectorAttachment(read(), phases)
      render()
      const roots = [...preview.querySelectorAll('.query-root')]
      expect(roots.map(node => node.id)).toEqual(nativeSelectorAttachmentLeafIds.filter(id =>
        open || id.startsWith('visible-'),
      ))
      for (const node of roots) {
        expect(node.textContent).toBe(node.id)
      }
    }
    render()
    await observe('attached', false)
    for (const { phase, open } of [{ phase: 'probe-1', open: true }, { phase: 'probe-2', open: false }]) {
      page.toggle(open)
      render()
      expect(page.probe()).toBe(phase)
      await observe(phase, open)
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
