import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
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
        await delay(0)
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
})
