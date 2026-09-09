import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserProject, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { npmComponentFiles, npmModuleFiles } from './helpers/npmModules'

describe.each(['node', 'browser'] as const)('%s mini-program npm dependency resolution', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSessionFromFiles(files: Array<[string, string]>) {
    if (provider === 'browser') {
      const virtualFiles = createBrowserVirtualFiles(files)
      return createBrowserHeadlessSession({
        files: virtualFiles,
        project: createBrowserProject(virtualFiles, { appConfigPath: 'dist/app.json', miniprogramRootPath: '/dist' }),
      })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-npm-modules-'))
    directories.push(projectPath)
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  function createSession(request?: string, omitNestedHelper = false) {
    return createSessionFromFiles(npmModuleFiles(request).filter(([file]) => !omitNestedHelper || !file.includes('/ui/miniprogram_npm/tslib/')))
  }

  it('renders bare npm components with nested scoped dependencies and local references', () => {
    const session = createSessionFromFiles(npmComponentFiles())
    try {
      session.reLaunch('/pages/index/index')
      const markup = session.renderCurrentPage().wxml
      for (const label of ['root dialog', 'relative popup', 'nested icon', 'scoped component', 'local component', 'root component']) {
        expect(markup).toContain(`>${label}<`)
      }
      expect(markup).not.toContain('root icon')
    }
    finally {
      session.close()
    }
  })

  it('uses the nearest subpackage npm component while resolving shared components at the root', () => {
    const session = createSessionFromFiles(npmComponentFiles())
    try {
      session.reLaunch('/sub/page/index')
      const markup = session.renderCurrentPage().wxml
      for (const label of ['subpackage dialog', 'scoped component', 'local component', 'root component']) {
        expect(markup).toContain(`>${label}<`)
      }
      expect(markup).not.toContain('root dialog')
    }
    finally {
      session.close()
    }
  })

  it.each([
    { omitNestedHelper: false, expected: 'nested-helper:root-shared:detail:json' },
    { omitNestedHelper: true, expected: 'root-helper:root-shared:detail:json' },
  ])('renders dependencies using the nearest available npm directory ($omitNestedHelper)', ({ omitNestedHelper, expected }) => {
    const session = createSession(undefined, omitNestedHelper)
    try {
      session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).toContain(`>${expected}<`)
    }
    finally {
      session.close()
    }
  })

  it.each(['outside', 'host-only', 'node:fs', 'missing', 'ui/../../outside'])('rejects %s without escaping the mini-program artifact root', (request) => {
    const session = createSession(request)
    try {
      expect(() => session.reLaunch('/pages/index/index')).toThrow(`Cannot resolve require("${request}")`)
    }
    finally {
      session.close()
    }
  })
})
