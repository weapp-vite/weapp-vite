import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { sharedModuleStateFiles } from './helpers/sharedModuleState'

describe.each(['node', 'browser'] as const)('%s shared module state', (provider) => {
  it('loads a new page module while retaining unchanged shared modules and resetting local state', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-shared-module-'))
    for (const [file, source] of sharedModuleStateFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sharedModuleStateFiles) })
      : createHeadlessSession({ projectPath })
    try {
      const first = session.reLaunch('/pages/first/index')
      first.increment()
      expect(first.data).toMatchObject({ count: 1, local: 1, marker: 'first' })
      const second = session.reLaunch('/pages/second/index')
      expect(second).not.toBe(first)
      expect(second.data).toMatchObject({ count: 1, local: 0, marker: 'second' })
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
