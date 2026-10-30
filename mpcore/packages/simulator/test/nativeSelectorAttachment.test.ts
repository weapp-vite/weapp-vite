import type { NativeSelectorAttachmentSnapshot } from './helpers/nativeSelectorAttachment'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DomUtils, parseDocument } from 'htmlparser2'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { nativeSelectorAttachmentFiles, nativeSelectorAttachmentLeafIds } from './helpers/nativeSelectorAttachment'
import { assertNativeSelectorAttachment } from './helpers/selectorAttachmentAssertions'

describe('native attached selector scope and asynchronous callback parity', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each(['node', 'browser'] as const)('queries each own root across hidden and visible slot projection in %s', async (provider) => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-selector-attachment-'))
    directories.push(projectPath)
    for (const [file, source] of nativeSelectorAttachmentFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeSelectorAttachmentFiles) })

    try {
      const page = session.reLaunch('/pages/index/index')
      const read = () => page.snapshot() as NativeSelectorAttachmentSnapshot
      const phases: Array<{ phase: string, open: boolean }> = []
      const observe = async (phase: string, open: boolean) => {
        await expect.poll(() => {
          const snapshot = read()
          return nativeSelectorAttachmentLeafIds.every(id =>
            snapshot.leaves[id]?.queries.some(query => query.phase === phase),
          )
        }).toBe(true)
        phases.push({ phase, open })
        assertNativeSelectorAttachment(read(), phases)
        const tree = parseDocument(session.renderCurrentPage().wxml)
        const roots = DomUtils.findAll(node => node.attribs.class === 'query-root', tree.children)
        expect(roots.map(node => node.attribs.id)).toEqual(nativeSelectorAttachmentLeafIds.filter(id =>
          open || id.startsWith('visible-'),
        ))
        for (const node of roots) {
          expect(DomUtils.textContent(node)).toBe(node.attribs.id)
        }
      }

      await observe('attached', false)
      for (const { phase, open } of [{ phase: 'probe-1', open: true }, { phase: 'probe-2', open: false }]) {
        page.toggle(open)
        session.renderCurrentPage()
        expect(page.probe()).toBe(phase)
        await observe(phase, open)
      }
    }
    finally {
      session.close()
    }
  })
})
