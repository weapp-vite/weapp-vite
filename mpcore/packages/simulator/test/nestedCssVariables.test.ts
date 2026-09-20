import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { nestedCssVariableFiles } from './helpers/nestedCssVariables'

describe('nested CSS variable fixture runtime state', () => {
  it.each(['node', 'browser'] as const)('renders override classes and restores baseline state in %s', async (provider) => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-css-variables-'))
    for (const [file, source] of nestedCssVariableFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nestedCssVariableFiles) })
    try {
      const page = session.reLaunch('/pages/css-nested-vars/index')
      for (const state of ['initial', 'updated', 'initial']) {
        const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root)
        expect(await (await root.$('#vars-state'))?.text()).toBe(state)
        expect(await root.$$(`#vars-root.${state === 'updated' ? 'override' : 'baseline'}`)).toHaveLength(1)
        expect(await (await root.$('#vars-nested'))?.text()).toBe('Nested fallback')
        expect(await root.$$('.vars-block')).toHaveLength(4)
        page.toggle()
      }
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
