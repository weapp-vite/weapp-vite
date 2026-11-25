import path from 'node:path'
import { expect, it } from 'vitest'
import { buildTestArtifact, createTestProject } from 'weapp-vite/test'

it('renders the React mini-program page from its built artifact', async () => {
  const artifact = await buildTestArtifact({ cwd: path.resolve(import.meta.dirname, '..') })
  const project = createTestProject({ artifact })
  try {
    const page = await project.renderPage('/pages/index/index')
    expect(page.screen.getByText('React 组件互操作').textContent).toBe('React 组件互操作')
  }
  finally {
    await project.close()
  }
})
