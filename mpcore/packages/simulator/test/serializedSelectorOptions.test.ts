import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { serializedSelectorOptionsFiles } from './helpers/serializedSelectorOptions'

it('preserves selector fields when options cross the host JSON boundary', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(serializedSelectorOptionsFiles()) })
  try {
    const page = session.reLaunch('/pages/index/index')
    page.inspectSizes()
    await expect.poll(() => page.data.sizes).toMatchObject([
      { width: 80, height: 20 },
      { width: 40, height: 10 },
      { width: 60, height: 30 },
    ])
    page.inspect()
    await expect.poll(() => page.data.snapshot).toMatchObject([
      { id: 'probe', dataset: { state: 'ready' }, width: 80, height: 20, color: 'rgb(81, 81, 124)' },
    ])
  }
  finally {
    session.close()
  }
})
