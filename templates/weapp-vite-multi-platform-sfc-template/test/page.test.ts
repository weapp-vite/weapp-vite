import path from 'node:path'
import { expect, it } from 'vitest'
import { buildTestArtifact, createTestProject } from 'weapp-vite/test'

it('updates the multi-platform SFC page through the headless runtime', async () => {
  const artifact = await buildTestArtifact({ cwd: path.resolve(import.meta.dirname, '..') })
  const project = createTestProject({ artifact })
  try {
    const page = await project.renderPage('/pages/index/index')
    expect(page.screen.getByText('0').textContent).toBe('0')
    await page.user.tap(page.screen.getByRole('button'))
    expect(page.screen.getByText('1').textContent).toBe('1')
    expect(page.screen.getByText('doubled=2').textContent).toContain('doubled=2')
  }
  finally {
    await project.close()
  }
})
