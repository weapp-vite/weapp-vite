import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { componentDirectoryFiles, componentDirectoryRoute } from './helpers/componentDirectories'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe.each(['node', 'browser'] as const)('%s local component directories', (provider) => {
  function createSession(files = componentDirectoryFiles) {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-directories-'))
    directories.push(projectPath)
    for (const [name, source] of files) {
      const file = path.join(projectPath, name)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, source)
    }
    return createHeadlessSession({ projectPath })
  }

  it('renders root and relative directories, resolves nested directories and prefers an explicit stem', () => {
    const session = createSession()
    try {
      const page = session.reLaunch(componentDirectoryRoute)
      expect(session.selectComponent('#host')?.is).toBe('components/host/index')
      expect(session.selectComponent('#leaf')?.is).toBe('components/leaf/index')
      expect(session.selectComponent('#nested')?.is).toBe('components/leaf/index')
      expect(session.selectComponent('#preferred')?.is).toBe('components/preferred')
      const initial = session.renderCurrentPage().wxml
      expect(initial).toContain('host:initial')
      expect(initial).toContain('initial:0')
      expect(initial).toContain('root:0')
      expect(initial).toContain('explicit')
      expect(initial).not.toContain('directory-fallback')
      page.setData({ label: 'updated' })
      session.selectComponent('#leaf')!.increment()
      const rendered = session.renderCurrentPage().wxml
      expect(rendered).toContain('host:updated')
      expect(rendered).toContain('updated:0')
      expect(rendered).toContain('root:1')
      expect(session.getDiagnostics()).toEqual([])
    }
    finally {
      session.close()
    }
  })

  it.each([
    ['js', /Missing (?:virtual )?module[^\n]*components[/\\]preferred\.js/],
    ['wxml', /Missing template[^\n]*components[/\\]preferred\.wxml/],
  ] as const)('preserves a missing explicit %s error even when the directory entry is complete', (extension, failure) => {
    const session = createSession(componentDirectoryFiles.filter(([name]) => name !== `components/preferred.${extension}`))
    try {
      expect(() => session.reLaunch(componentDirectoryRoute)).toThrow(failure)
    }
    finally {
      session.close()
    }
  })
})
