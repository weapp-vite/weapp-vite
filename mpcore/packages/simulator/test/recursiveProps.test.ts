import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { recursivePropsFiles } from './helpers/recursiveProps'

describe.each(['node', 'browser'] as const)('%s recursive component properties', (provider) => {
  it('delivers independent property values through recursive components and forwards leaf input', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'recursive-props-'))
    for (const [file, source] of recursivePropsFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(recursivePropsFiles) })
    try {
      const page = session.reLaunch('/pages/index/index')
      const render = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
        callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
        createPageHandle: () => ({ data: async () => page.data }),
        createScopeHandle: () => null,
        ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
      })
      expect(await (await render().getElementsByXpath('//text[@id="leaf"]'))[0]?.text()).toBe('initial')
      const root = session.selectComponent('tree-node')!
      const leaf = root.selectComponent('tree-node')!
      page.update()
      expect(await (await render().getElementsByXpath('//text[@id="leaf"]'))[0]?.text()).toBe('updated')
      expect(root.selectComponent('tree-node')).toBe(leaf)
      expect(root.properties.node).not.toBe(page.data.tree)
      await (await render().getElementsByXpath('//input[@id="leaf-input"]'))[0]!.input('edited')
      expect(page.data.lastInput).toBe('edited')
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
