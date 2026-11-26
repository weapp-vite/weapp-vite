import path from 'node:path'
import { expect, it } from 'vitest'
import { buildTestArtifact, createTestProject } from 'weapp-vite/test'

it('updates the TDesign SFC page through the headless runtime', async () => {
  const artifact = await buildTestArtifact({ cwd: path.resolve(import.meta.dirname, '..') })
  const project = createTestProject({ artifact })
  try {
    const page = await project.renderPage('/pages/index/index')
    expect(page.screen.getByText('已点击 0 次').textContent).toBe('已点击 0 次')
    await page.user.tap(page.screen.getByRole('button'))
    expect(page.screen.getByText('已点击 1 次').textContent).toBe('已点击 1 次')
  }
  finally {
    await project.close()
  }
}, 30_000)
