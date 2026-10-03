import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { querySelectorAll } from '../src/view/selectors'
import { cleanupTempDirs } from './helpers'
import { nativeSlotEventFiles } from './helpers/nativeSlotEvents'

describe.each(['node', 'browser'] as const)('%s native slot events', (provider) => {
  const directories: string[] = []
  const sessions: Array<{ close: () => void }> = []
  afterEach(() => {
    sessions.splice(0).forEach(session => session.close())
    cleanupTempDirs(directories)
  })

  function createSession() {
    let session
    if (provider === 'browser') {
      session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeSlotEventFiles) })
    }
    else {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-native-slot-'))
      directories.push(projectPath)
      for (const [file, source] of nativeSlotEventFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      session = createHeadlessSession({ projectPath })
    }
    sessions.push(session)
    return session
  }

  it('resolves the nearest raw slot host synchronously during attached and isolates rebuilt contexts', () => {
    const session = createSession()
    session.reLaunch('/pages/index/index')
    const text = (selector: string) => querySelectorAll(session.renderCurrentPage().root, selector)[0]?.children?.map(node => node.data ?? '').join('')
    const tap = (selector: string) => {
      const node = querySelectorAll(session.renderCurrentPage().root, selector)[0]!
      session.dispatchNativeNodeEvent(node, 'tap', {})
    }

    expect(text('#leaf-left')).toBe('left/0/true')
    expect(text('#leaf-right')).toBe('right/10/true')
    expect(text('#leaf-inner')).toBe('inner/200/true')
    expect(text('#leaf-inner-internal')).toBe('inner/200/true')
    expect(text('#export-inner-internal')).toBe('increment,label')
    tap('#leaf-inner-internal')
    expect(text('#host-inner')).toBe('201')
    expect(text('#host-outer')).toBe('100')
    tap('#leaf-left')
    expect(text('#host-left')).toBe('1')
    expect(text('#leaf-left')).toBe('left/1/true')
    expect(text('#host-right')).toBe('10')
    tap('#leaf-inner')
    expect(text('#host-inner')).toBe('202')
    expect(text('#host-outer')).toBe('100')
    tap('#toggle')
    expect(text('#leaf-left')).toBeUndefined()
    tap('#toggle')
    expect(text('#leaf-left')).toBe('left/40/true')
    tap('#leaf-left')
    expect(text('#host-left')).toBe('41')
    expect(text('#host-right')).toBe('10')
    expect(text('#host-inner')).toBe('202')
  })
})
