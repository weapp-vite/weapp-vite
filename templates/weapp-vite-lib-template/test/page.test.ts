import path from 'node:path'
import { expect, it } from 'vitest'
import { buildTestArtifact, createTestProject } from 'weapp-vite/test'

it('renders the component library showcase from its built artifact', async () => {
  const artifact = await buildTestArtifact({ cwd: path.resolve(import.meta.dirname, '..') })
  const project = createTestProject({ artifact })
  try {
    const page = await project.renderPage('/pages/index/index')
    expect(page.screen.getByText('weapp-vite component library').textContent).toBe('weapp-vite component library')
  }
  finally {
    await project.close()
  }
}, 30_000)
