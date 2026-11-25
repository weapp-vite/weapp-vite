import path from 'node:path'
import { expect, it } from 'vitest'
import { buildTestArtifact, createTestProject } from 'weapp-vite/test'

it('renders the Tailwind starter page from its built mini-program artifact', async () => {
  const artifact = await buildTestArtifact({ cwd: path.resolve(import.meta.dirname, '..') })
  const project = createTestProject({ artifact })
  try {
    const page = await project.renderPage('/pages/index/index')
    expect(page.screen.getByText('Hello weapp-vite').textContent).toBe('Hello weapp-vite')
  }
  finally {
    await project.close()
  }
}, 30_000)
