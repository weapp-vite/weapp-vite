import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createBehaviorRegistrationFiles, validNestedBehavior } from './helpers/behaviorRegistration'

describe.each(['node', 'browser'] as const)('%s native Behavior registration', (provider) => {
  function withSession(behavior: string, componentPage: boolean, check: (session: ReturnType<typeof createHeadlessSession> | ReturnType<typeof createBrowserHeadlessSession>) => void) {
    const files = createBehaviorRegistrationFiles(behavior, componentPage)
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-behavior-registration-'))
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    try {
      check(session)
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  }

  it.each([false, true])('rejects a build placeholder during Component registration (component page: %s)', (componentPage) => {
    withSession('{ __WEAPP_VITE_I18N__: true }', componentPage, (session) => {
      expect(() => session.reLaunch('/pages/index/index')).toThrow('Behaviors should be constructed with Behavior()')
    })
  })

  it('rejects a nested plain behavior definition', () => {
    withSession('Behavior({ behaviors: [{ data: { label: "unconstructed" } }] })', false, (session) => {
      expect(() => session.reLaunch('/pages/index/index')).toThrow('Behaviors should be constructed with Behavior()')
    })
  })

  it('keeps constructed nested behaviors and built-in behavior strings working', () => {
    withSession(validNestedBehavior, false, (session) => {
      session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).toContain('>constructed behavior</text>')
    })
  })
})
