import { rm } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { createIssue1074Project } from '../../../../e2e/utils/issue1074Project'
import { createWeappViteTestProject } from './index'

it('renders Doctor custom-method and independent-package evidence through the public adapter', async () => {
  const cwd = await createIssue1074Project()
  const project = await createWeappViteTestProject({ cwd, skipNpm: true })
  try {
    const page = await project.renderPage('/pages/index/index')
    expect(page.screen.getByText('custom-at')).toBeDefined()
    await page.user.tap(page.screen.getByRole('button'))
    expect(page.screen.getByText('custom-replace')).toBeDefined()
    expect(page.screen.getByText('1')).toBeDefined()
    await page.close()
    const independent = await project.renderPage('/isolated/index')
    expect(independent.screen.getByText('independent-ready')).toBeDefined()
    await independent.close()
  }
  finally {
    await project.close()
    await rm(cwd, { recursive: true, force: true })
  }
}, 60_000)
