import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserProject, createBrowserVirtualFiles } from '../src/browser'
import { npmComponentFiles, npmModuleFiles } from '../test/helpers/npmModules'

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

it('renders npm usingComponents from a non-root artifact directory and switches to subpackage components', () => {
  const files = createBrowserVirtualFiles(npmComponentFiles())
  const session = createBrowserHeadlessSession({
    files,
    project: createBrowserProject(files, { appConfigPath: 'dist/app.json', miniprogramRootPath: '/dist' }),
  })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#dialog-label')?.textContent).toBe('root dialog')
    expect(preview.querySelector('#popup-label')?.textContent).toBe('relative popup')
    expect(preview.querySelector('#icon-label')?.textContent).toBe('nested icon')
    expect(preview.querySelector('#scoped-label')?.textContent).toBe('scoped component')
    expect(preview.querySelector('#local-label')?.textContent).toBe('local component')
    expect(preview.querySelector('#root-label')?.textContent).toBe('root component')

    session.reLaunch('/sub/page/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelectorAll('#dialog-label')).toHaveLength(1)
    expect(preview.querySelector('#dialog-label')?.textContent).toBe('subpackage dialog')
    expect(preview.querySelector('#scoped-label')?.textContent).toBe('scoped component')
  }
  finally {
    session.close()
    preview.remove()
  }
})
