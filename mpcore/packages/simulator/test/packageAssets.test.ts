import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserProject, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createPackageAssetReader } from '../src/runtime/packageAsset'
import { packageAssetFiles } from './helpers/packageAssetFiles'

describe.each(['node', 'browser'] as const)('%s package asset reads', (provider) => {
  it('reads current packaged bytes through creation, edits, removal and restoration without replacing the page', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-package-assets-'))
    const files = createBrowserVirtualFiles(packageAssetFiles)
    for (const [file, content] of files) {
      fs.mkdirSync(path.dirname(path.join(projectPath, file)), { recursive: true })
      fs.writeFileSync(path.join(projectPath, file), content)
    }
    const session = provider === 'node' ? createHeadlessSession({ projectPath }) : createBrowserHeadlessSession({ files, project: createBrowserProject(files, { appConfigPath: 'dist/app.json', miniprogramRootPath: 'dist' }) })
    try {
      const page = session.reLaunch('/pages/index/index')
      const file = 'dist/resources/live.png'
      for (const content of ['first', 'edited', undefined, 'restored']) {
        if (content === undefined) {
          files.delete(file)
          fs.rmSync(path.join(projectPath, file))
        }
        else {
          files.set(file, content)
          fs.mkdirSync(path.dirname(path.join(projectPath, file)), { recursive: true })
          fs.writeFileSync(path.join(projectPath, file), content)
        }
        page.read()
        expect(page.data).toMatchObject({ count: 2, content: content ?? 'missing' })
        expect(session.getCurrentPages()[0]).toBe(page)
      }
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})

it('confines package reads to readable assets inside the package', () => {
  const read = createPackageAssetReader(file => file)
  expect(read('/resources/./image.png')).toBe('resources/image.png')
  for (const file of ['../secret.png', 'wxfile://usr/image.png', 'C:\\image.png', 'app.js', 'app.json', 'page.wxml', 'arbitrary.data']) {
    expect(read(file)).toBeUndefined()
  }
})
