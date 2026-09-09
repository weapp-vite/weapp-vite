import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { cleanupTempDirs } from './helpers'
import { renderedSelectorsFiles } from './helpers/renderedSelectors'

describe('rendered dynamic ancestors', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  for (const provider of ['node', 'browser'] as const) {
    it(`queries actual rendered ancestors after component events in ${provider}`, async () => {
      const files = renderedSelectorsFiles()
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-rendered-selectors-'))
      directories.push(projectPath)
      for (const [file, source] of files) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      const root = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
        callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
        createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
        createScopeHandle: () => null,
        ownerScopeId: () => null,
      })
      try {
        session.reLaunch('/pages/index/index')
        expect(await root().$$('.emit-record')).toHaveLength(0)
        const button = await (await root().$('emitter'))!.$('#emit-direct-payload')
        expect(button).not.toBeNull()
        await button!.tap()
        expect(await root().$$('.emit-record')).toHaveLength(1)
        expect(await (await root().$('#emit-record-0 .emit-label'))?.text()).toBe('payload-1')

        await (await (await root().$('emitter'))!.$('#emit-direct-payload'))!.tap()
        expect(await root().$$('.emit-record')).toHaveLength(2)
        expect(await (await root().$('#emit-record-0 > .emit-label'))?.text()).toBe('payload-2')
        expect(await (await root().$('#emit-record-0 + #emit-record-1 .emit-label'))?.text()).toBe('payload-1')
        await (await (await root().$('emitter'))!.$('#emit-native'))!.tap()
        expect(await (await root().$('#native-result'))?.text()).toBe('tap:undefined:number')
      }
      finally {
        session.close()
      }
    })
  }
})
