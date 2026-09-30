import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserProject, createBrowserVirtualFiles } from '../src/browser'
import { packageAssetFiles } from '../test/helpers/packageAssetFiles'

it('renders current packaged asset content without resetting the page during asset lifecycle updates', () => {
  const files = createBrowserVirtualFiles(packageAssetFiles)
  const session = createBrowserHeadlessSession({ files, project: createBrowserProject(files, { appConfigPath: 'dist/app.json', miniprogramRootPath: 'dist' }) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    for (const content of ['first', 'edited', undefined, 'restored']) {
      const file = 'dist/resources/live.png'
      if (content === undefined) {
        files.delete(file)
      }
      else {
        files.set(file, content)
      }
      page.read()
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#content')?.textContent).toBe(content ?? 'missing')
      expect(preview.querySelector('#count')?.textContent).toBe('2')
      expect(session.getCurrentPages()[0]).toBe(page)
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
