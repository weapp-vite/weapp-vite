import path from 'node:path'
import { expect, it } from 'vitest'
import { buildTestArtifact, createTestProject } from 'weapp-vite/test'

it('updates reactive page state through the headless mini-program runtime', async () => {
  const artifact = await buildTestArtifact({ cwd: path.resolve(import.meta.dirname, '..') })
  const project = createTestProject({ artifact })
  try {
    const page = await project.renderPage('/pages/index/index')
    expect(page.screen.getByText('count: 0').textContent).toBe('count: 0')
    await page.user.tap(page.screen.getByRole('button'))
    expect(page.screen.getByText('count: 1').textContent).toBe('count: 1')
    expect(page.screen.getByText('double: 2').textContent).toBe('double: 2')
  }
  finally {
    await project.close()
  }
})
