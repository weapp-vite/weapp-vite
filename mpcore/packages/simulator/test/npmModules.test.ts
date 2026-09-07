import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserProject, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { npmModuleFiles } from './helpers/npmModules'

describe.each(['node', 'browser'] as const)('%s mini-program npm dependency resolution', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession(request?: string, omitNestedHelper = false) {
    const files = npmModuleFiles(request).filter(([file]) => !omitNestedHelper || !file.includes('/ui/miniprogram_npm/tslib/'))
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
