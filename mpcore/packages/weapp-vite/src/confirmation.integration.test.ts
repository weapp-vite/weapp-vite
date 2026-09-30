import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createIssue1082Project } from '../../../../e2e/utils/issue1082Project'
import { createWeappViteTestProject } from './index'

describe('issue #1082 artifact adapter parity', () => {
  it('renders the confirmation fixture and its event state', async () => {
    const cwd = await createIssue1082Project()
    const project = await createWeappViteTestProject({ cwd, skipNpm: true })
    try {
      const routes = ['/pages/home/index']
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
