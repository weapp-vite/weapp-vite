import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createWebCryptoFiles } from './helpers/webCrypto'

it('keeps synchronous UUID generation independent of asynchronous mini-program random APIs', async () => {
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles(await createWebCryptoFiles()),
  })
  try {
    for (let index = 0; index < 2; index++) {
      const page = session.reLaunch('/pages/index')
      expect(page.data).toMatchObject({ hostCalls: 0, sameArray: true, unique: true, valid: true })
      expect(session.renderCurrentPage().wxml).toContain('0/true/true/true')
    }
  }
  finally {
    session.close()
  }
})
