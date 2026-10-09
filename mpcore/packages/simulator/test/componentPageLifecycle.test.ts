import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { attachmentBindingTrace, createAttachmentBindingFiles } from './helpers/attachmentBindings'
import { attachmentClampTrace, attachmentDetachTrace, createAttachmentBatchFiles, createAttachmentCreatedWriteFiles, createAttachmentOwnerWriteFiles, createAttachmentReentryFiles } from './helpers/attachmentReentry'
import { componentPageLifecycleTrace, createComponentPageLifecycleFiles } from './helpers/componentPageLifecycle'

describe.each(['node', 'browser'] as const)('%s Component page lifecycle', (provider) => {
  it.each([false, true])('attaches the page context before descendants after each relaunch (query during attachment: %s)', async (queryDuringAttachment) => {
    const componentPageLifecycleFiles = createComponentPageLifecycleFiles(queryDuringAttachment)
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-page-lifecycle-'))
    fs.writeFileSync(path.join(projectPath, 'project.config.json'), '{"appid":"wx1234567890abcdef","miniprogramRoot":"."}')
    for (const [file, source] of componentPageLifecycleFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentPageLifecycleFiles) })
    try {
      for (let index = 0; index < 2; index++) {
        const page = session.reLaunch('/pages/index/index')
        await expect.poll(() => page.snapshot()).toEqual(componentPageLifecycleTrace)
        expect(session.renderCurrentPage().wxml).toContain('>page-provide-value</text>')
        const trace = page.snapshot() as string[]
        expect(trace).toEqual(componentPageLifecycleTrace)
        session.renderCurrentPage()
        expect(page.snapshot()).toEqual(trace)
        session.reLaunch('/pages/empty/index')
      }
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })

  for (const owner of ['page', 'component'] as const) {
    it.each([
      { hidden: false, insert: false },
      { hidden: true, insert: false },
      { hidden: false, insert: true },
      { hidden: true, insert: true },
    ])(`delivers ${owner} attachment writes before child setup (unprojected: $hidden, inserted: $insert)`, ({ hidden, insert }) => {
      const files = createAttachmentBindingFiles(owner, hidden, insert)
      const expectedTrace = insert ? attachmentBindingTrace.slice(1) : attachmentBindingTrace
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-attachment-bindings-'))
      for (const [file, source] of files) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(page.readTrace()).toEqual(expectedTrace)
        const rendered = session.renderCurrentPage().wxml
        expect(rendered.includes('>bound</text>')).toBe(!hidden)
        expect(page.readTrace()).toEqual(expectedTrace)
      }
      finally {
        session.close()
        fs.rmSync(projectPath, { recursive: true, force: true })
      }
    })
  }

  it.each(['clamp', 'detach'] as const)('preserves native ordering for reentrant %s writes', async (scenario) => {
    const files = createAttachmentReentryFiles(scenario)
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-attachment-reentry-'))
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    try {
      const page = session.reLaunch('/pages/index/index')
      if (scenario === 'detach') {
        page.trigger()
      }
      const rendered = session.renderCurrentPage().wxml
      const expected = scenario === 'clamp' ? attachmentClampTrace : attachmentDetachTrace
      expect(page.readTrace()).toEqual(expected)
      if (scenario === 'clamp') {
        expect(rendered).toContain('>100</text>')
      }
      else {
        expect(rendered).toContain('id="retained"')
        expect(rendered).not.toContain('id="removed"')
      }
      const completion = Promise.withResolvers<void>()
      session.requestRender(completion.resolve)
      await completion.promise
      session.renderCurrentPage()
      expect(page.readTrace()).toEqual(expected)
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it.each(['existing', 'inserted', 'loop', 'unprojected'] as const)('keeps the latest owner write across %s binding traversal', (scenario) => {
    const files = createAttachmentOwnerWriteFiles(scenario)
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-attachment-owner-write-'))
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    try {
      const page = session.reLaunch('/pages/index/index')
      const snapshot = page.snapshot() as { after: number[], delivered: number[], attached: Record<string, number[]> }
      expect(snapshot.after).toEqual([2, 2])
      expect(snapshot.attached).toEqual({ first: [2], second: [2] })
      expect(snapshot.delivered.at(-1)).toBe(2)
      expect(snapshot.delivered.slice(snapshot.delivered.indexOf(2))).not.toContain(1)
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it.each(['middle', 'leaf'] as const)('completes private construction and properties after %s created writes', (writer) => {
    const files = createAttachmentCreatedWriteFiles(writer)
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-attachment-created-write-'))
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    try {
      const page = session.reLaunch('/pages/index/index')
      expect(page.snapshot()).toEqual({
        created: [['first', 'second']],
        observed: [[['first', 'bound'], ['second', 'bound']]],
        attached: { first: ['bound'], second: ['bound'] },
      })
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('finishes every attachment write before ready in a sibling batch', async () => {
    const rows = Array.from({ length: 32 }, (_, index) => index)
    const files = createAttachmentBatchFiles(rows.length)
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-attachment-batch-'))
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    try {
      const page = session.reLaunch('/pages/index/index')
      await expect.poll(() => page.snapshot()).toEqual([
        ...rows.flatMap(row => [['attached', row], ['after', row, true]]),
        ...rows.map(row => ['ready', row]),
      ])
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
