import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserProject, createBrowserVirtualFiles } from '../src/browser'
import { npmModuleFiles } from '../test/helpers/npmModules'

it('renders a component package with nested npm and shared scoped dependencies', () => {
  const files = createBrowserVirtualFiles(npmModuleFiles())
  const session = createBrowserHeadlessSession({
    files,
    project: createBrowserProject(files, { appConfigPath: 'dist/app.json', miniprogramRootPath: '/dist' }),
  })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelectorAll('#module-label')).toHaveLength(1)
    expect(preview.querySelector('#module-label')?.textContent).toBe('nested-helper:root-shared:detail:json')
  }
  finally {
    session.close()
    preview.remove()
  }
})
