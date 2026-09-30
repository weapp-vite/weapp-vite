import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createIssue1034Project } from '../../../../e2e/utils/issue1034Project'
import { createWeappViteTestProject } from './index'

describe('issue #1034 artifact adapter parity', () => {
  it('renders selected Vue sources and explicit sibling dependencies in all package kinds', async () => {
    const cwd = await createIssue1034Project()
    const project = await createWeappViteTestProject({ cwd, skipNpm: true })
    try {
      const routes = ['/pages/home/index', '/subpackages/account/pages/detail/index', '/subpackages/isolated/pages/detail/index']
      for (const [index, route] of routes.entries()) {
        const result = await project.renderPage(route)
        expect(result.screen.getByText(`vue-business-${index}`)).toBeDefined()
        await result.user.tap(result.screen.getByRole('button'))
        expect(result.screen.getByText('1')).toBeDefined()
        await result.close()
      }
    }
    finally {
      await project.close()
      await rm(cwd, { recursive: true, force: true })
    }
  }, 60_000)
})
