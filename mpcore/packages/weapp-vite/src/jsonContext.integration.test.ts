import { rm } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { createIssue1072Project } from '../../../../e2e/utils/issue1072Project'
import { createWeappViteTestProject } from './index'

it('renders pages compiled with inline, external and dynamic metadata', async () => {
  const cwd = await createIssue1072Project()
  const project = await createWeappViteTestProject({ cwd, skipNpm: true })
  try {
    for (const name of ['home', 'external', 'dynamic']) {
      const result = await project.renderPage(`/pages/${name}/index`)
      expect(result.screen.getByText('0')).toBeDefined()
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
