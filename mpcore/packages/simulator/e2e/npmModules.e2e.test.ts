import { expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserHeadlessSession, createBrowserProject, createBrowserVirtualFiles } from '../src/browser'
import { npmComponentFiles, npmMappedComponentFiles, npmModuleFiles } from '../test/helpers/npmModules'

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

it('dispatches real preview clicks through npm components in callback and manual output directories', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const viewport = ref({ height: 844, width: 390 })
  const workbench = useWorkbenchSession(viewport)
  const app = createApp({
    setup: () => () => h(DevicePreview, {
      markup: workbench.previewMarkup.value,
      styleText: workbench.previewStyles.value,
      route: workbench.currentRoute.value,
      viewportHeight: viewport.value.height,
      viewportWidth: viewport.value.width,
      onDispatchTap: workbench.handleDispatchTap,
      onSelectScope: workbench.handleSelectScope,
    }),
  })
  app.mount(preview)
  try {
    const artifactFiles = npmMappedComponentFiles()
      .filter(([file]) => file.startsWith('dist/'))
      .map(([file, source]): [string, string] => [file.slice('dist/'.length), source])
    workbench.loadSession('npm-mapped-components', createBrowserVirtualFiles(artifactFiles))
    workbench.handleOpenRoute('customized/pages/npm-options/index')
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    await vi.waitFor(() => expect(shadow.querySelector('#npm-counts')?.textContent).toBe('0/0/0'))
    expect(Array.from(shadow.querySelectorAll('.npm-helper')).map(element => element.textContent)).toEqual([
      'subpackage helper',
      'mapped helper',
      'subpackage helper',
    ])
    for (const [kind, counts] of [['callback', '1/0/0'], ['mapped', '1/1/0'], ['disabled', '1/1/0']]) {
      shadow.querySelector<HTMLElement>(`#npm-${kind}-button`)!.click()
      await vi.waitFor(() => expect(shadow.querySelector('#npm-counts')?.textContent).toBe(counts))
    }
    expect(workbench.errorMessage.value).toBe('')
  }
  finally {
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
  }
})
