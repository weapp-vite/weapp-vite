import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { cleanupTempDirs } from './helpers'
import { createSharedTemplateParserFiles, sharedTemplateExpressionValues } from './helpers/sharedTemplateParser'

describe('shared WXML source parsing in rendered sessions', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each(['node', 'browser'] as const)('preserves template clones, first bare values and raw WXS strings in %s', async (provider) => {
    const files = createSharedTemplateParserFiles()
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-template-parser-'))
    directories.push(projectPath)
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
      const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root)
      expect(page.selectAllComponents!('.cloned').map(component => component.properties.payload)).toEqual([true, true])
      const nodes = await root.$$('.cloned')
      expect(nodes).toHaveLength(2)
      for (const node of nodes) {
        expect(await (await node.$('.bare-summary'))!.text()).toBe('boolean:true')
        expect(await node.attr('title')).toBe('a"b')
        expect(await node.attr('data-path')).toBe(String.raw`path\file`)
        expect(await node.attr('data-entity')).toBe('&amp;')
        expect(await node.attr('data-closing')).toBe('</wxs>')
        expect(await node.attr('data-division')).toBe('function-division')
        expect(await node.attr('data-commented-external')).toBe('comment-ignored')
        expect(await node.attr('data-commented-inline')).toBe('comment-ignored')
      }
      const expressions = await root.$('#setter-expressions')
      expect(expressions).not.toBeNull()
      expect(await expressions!.attr('data-static-entity')).toBe('&amp;')
      for (const [name, value] of Object.entries(sharedTemplateExpressionValues)) {
        expect(await expressions!.attr(name)).toBe(value)
      }
      expect(session.getDiagnostics()).toEqual([])
    }
    finally {
      session.close()
    }
  })
})
