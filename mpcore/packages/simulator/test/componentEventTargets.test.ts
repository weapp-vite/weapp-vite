import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { cleanupTempDirs } from './helpers'
import { componentEventTargetFiles } from './helpers/componentEventTargets'

describe.each(['node', 'browser'] as const)('%s component event targets', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession() {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentEventTargetFiles) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-event-targets-'))
    directories.push(projectPath)
    for (const [file, source] of componentEventTargetFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  it('targets the emitting component host while preserving a forwarded native event in detail', async () => {
    const session = createSession()
    const render = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
    try {
      const page = session.reLaunch('/pages/index/index')
      for (const kind of ['cancel', 'confirm']) {
        const dialog = (await render().$('dialog-box'))!
        const host = (await dialog.$(`#${kind}-host`))!
        await (await host.$(`#${kind}-native`))!.tap()
        expect(await (await render().$('#result'))?.text()).toBe(`${kind}/${kind}-host/${kind}-native`)
        expect(page.data.result).toEqual({
          kind,
          target: { id: `${kind}-host`, dataset: { type: kind } },
          currentTarget: { id: `${kind}-host`, dataset: { type: kind } },
          nativeTarget: { id: `${kind}-native`, dataset: { native: kind } },
        })
      }
    }
    finally {
      session.close()
    }
  })

  it.each(['page', 'component'] as const)('binds a replaced %s event handler to its current instance', (owner) => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      session.renderCurrentPage()
      const dialog = session.selectComponent('dialog-box')!
      const button = dialog.selectComponent('#confirm-host')!
      const instance = owner === 'page' ? page : dialog
      const methodName = owner === 'page' ? 'receive' : 'onButton'
      const original = instance[methodName]
      const receivers: unknown[] = []
      instance[methodName] = function (event: unknown) {
        receivers.push(this)
        return original.call(this, event)
      }
      const buttonScope = session.getScopeIdForComponent(button)!
      session.callScopeMethod(buttonScope, 'handleTap', {
        target: { id: 'confirm-native', dataset: { native: 'confirm' } },
      })
      expect(receivers).toHaveLength(1)
      expect(receivers[0]).toBe(instance)
      expect(session.renderCurrentPage().wxml).toContain('confirm/confirm-host/confirm-native')
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.selectComponent('dialog-box')).toBe(dialog)
    }
    finally {
      session.close()
    }
  })
})
