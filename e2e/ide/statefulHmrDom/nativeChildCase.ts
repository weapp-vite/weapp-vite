import type { createDomAcceptance } from '../../utils/domAcceptance'
import { expect } from 'vitest'

export async function verifyNativeChildHmr(options: {
  dom: ReturnType<typeof createDomAcceptance>
  miniProgram: any
  patch: (updated: boolean) => Promise<void>
  childSelector?: string
}) {
  const { dom, miniProgram, patch, childSelector = '#native-counter' } = options
  const page = await miniProgram.reLaunch('/pages/component/index?source=child-e2e')
  const element = async (selector: string, child = false) => {
    const roots = child ? await page.$$(childSelector, { fallback: false }) : [page]
    expect(roots).toHaveLength(1)
    const nodes = await roots[0].$$(selector, { fallback: false })
    expect(nodes).toHaveLength(1)
    return nodes[0]
  }
  const check = async (id: string) => {
    const current = await miniProgram.currentPage()
    expect(current.pageId).toBe(page.pageId)
    await dom.check(id, miniProgram, current)
  }
  await check('initial')
  await (await element('.input')).input('held-input')
  await (await element('.parent-increment')).tap()
  await (await element('.child-increment', true)).tap()
  await check('prepared')
  try {
    await patch(true)
    await check('patched')
    await (await element('.child-increment', true)).tap()
    await check('updated')
  }
  finally {
    await patch(false)
  }
  await check('restored')
  await (await element('.child-increment', true)).tap()
  await (await element('.parent-increment')).tap()
  await check('restored-interaction')
}
