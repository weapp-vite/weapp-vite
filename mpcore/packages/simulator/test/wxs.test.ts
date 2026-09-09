import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { cleanupTempDirs } from './helpers'
import { wxsFiles } from './helpers/wxs'

describe('WXS template modules', () => {
  const tempDirs: string[] = []
  afterEach(() => cleanupTempDirs(tempDirs))

  function createSession(provider: 'node' | 'browser', files = wxsFiles) {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-wxs-'))
    tempDirs.push(projectPath)
    for (const [relativePath, source] of files) {
      const target = path.join(projectPath, relativePath)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  for (const provider of ['node', 'browser'] as const) {
    it(`renders external and inline modules in isolated template scopes with ${provider}`, async () => {
      const session = createSession(provider)
      try {
        const page = session.reLaunch('/pages/index/index')
        for (const platform of ['weapp', 'updated']) {
          page.setData({ platform })
          const rendered = session.renderCurrentPage()
          const root = new HeadlessTestingNodeHandle(rendered.root)
          expect(await (await root.$('#platform-marker'))?.text()).toBe(`MP_PLATFORM=${platform}`)
          expect(await (await root.$('#local'))?.text()).toBe(platform)
          expect(await (await root.$('#imported'))?.text()).toBe(`imported:${platform}`)
          expect(await (await root.$('#component'))?.text()).toBe(`component:${platform}`)
          expect(await (await root.$('#import-leak'))?.text()).toBe('')
          expect(await (await root.$('#component-leak'))?.text()).toBe('')
          expect(await (await root.$('#inline'))?.text()).toBe('undefined:undefined')
          expect(await (await root.$('#payload'))?.text()).toBe('wxs-copy')
          expect(await (await root.$('#literal'))?.text()).toBe('<tag></script>')
          expect(await Promise.all((await root.$$('.loop')).map(node => node.text()))).toEqual([platform, 'second'])
          expect(rendered.wxml).not.toContain('<wxs')
          expect(rendered.wxml).not.toContain('module.exports')
          expect(page.data.payload).toEqual({ label: 'original' })
          expect(page.data.platformTools).toBe('page-data')
          expect(page.data).not.toHaveProperty('inlineTools')
        }
      }
      finally {
        session.close()
      }
    })

    it(`reports missing WXS modules instead of empty successful output with ${provider}`, () => {
      const session = createSession(provider, wxsFiles.filter(([file]) => file !== 'pages/index/format.wxs'))
      try {
        expect(() => {
          session.reLaunch('/pages/index/index')
          session.renderCurrentPage()
        }).toThrow('Missing WXS module:')
      }
      finally {
        session.close()
      }
    })

    it(`rejects duplicate module declarations with ${provider}`, () => {
      const files = wxsFiles.map(([file, source]): [string, string] => [file, file.endsWith('pages/index/index.wxml')
        ? `${source}<wxs module="platformTools" src="./platform.wxs" />`
        : source])
      const session = createSession(provider, files)
      try {
        expect(() => {
          session.reLaunch('/pages/index/index')
          session.renderCurrentPage()
        }).toThrow('Duplicate WXS module')
      }
      finally {
        session.close()
      }
    })
  }
})
