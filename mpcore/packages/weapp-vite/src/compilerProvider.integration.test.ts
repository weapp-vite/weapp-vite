import { rm } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { createIssue1065Project } from '../../../../e2e/utils/issue1065Project'
import { createWeappViteTestProject } from './index'

it('renders third-party provider output through the public build adapter and preserves events', async () => {
  const cwd = await createIssue1065Project()
  const project = await createWeappViteTestProject({ cwd, skipNpm: true })
  try {
    const result = await project.renderPage('/pages/home/index')
    expect(result.screen.getByText('script-after initial')).toBeDefined()
    expect(result.screen.getByText('0')).toBeDefined()
    await result.user.tap(result.screen.getByRole('button'))
    expect(result.screen.getByText('1')).toBeDefined()
    await result.close()
  }
  finally {
    await project.close()
    await rm(cwd, { recursive: true, force: true })
  }
}, 60_000)
