import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseDocument } from 'htmlparser2'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { createLogicalNode } from '../src/testing/logicalSnapshot'
import { HeadlessTestingNodeHandle, renderPageTree } from '../src/view'
import { cleanupTempDirs } from './helpers'
import { richTextFiles, richTextHtmlText, untrustedRichText, untrustedRichTextContent, untrustedRichTextHtml, untrustedRichTextHtmlContent } from './helpers/richText'

const directories: string[] = []
afterEach(() => cleanupTempDirs(directories))

function createProject() {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-rich-text-'))
  directories.push(projectPath)
  for (const [file, source] of richTextFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  return projectPath
}

describe.each(['node', 'browser', 'testing-fallback'] as const)('%s rich-text rendering', (provider) => {
  function createSession() {
    return provider === 'browser'
      ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(richTextFiles) })
      : createHeadlessSession({ projectPath: createProject() })
  }

  it('materializes structured nodes and decoded HTML in the tree, serialization and generic text observation', async () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      const render = () => provider === 'testing-fallback'
        ? renderPageTree(session.project, page)
        : session.renderCurrentPage()
      const check = async (selector: string, text: string) => {
        const tree = render()
        const node = await new HeadlessTestingNodeHandle(tree.root).$(selector)
        expect(node, selector).not.toBeNull()
        expect(await node!.text()).toBe(text)
        const serialized = await new HeadlessTestingNodeHandle(parseDocument(tree.wxml)).$(selector)
        expect(await serialized!.text()).toBe(text)
        expect(createLogicalNode(tree.root).text).toContain(text)
      }

      await check('#plain', 'Rendered content')
      await check('#structured', 'Rendered content')
      await check('#html', richTextHtmlText)
      await check('#empty', '')
      await check('#literal', 'literal & text')
      const structured = (await new HeadlessTestingNodeHandle(render().root).$('#structured'))!
      expect(await structured.wxml()).toContain('<p>Rendered content</p>')
      expect(await structured.attr('nodes')).toBe('[object Object]')
      expect(session.getApp()!.globalData.attached).toBe(0)

      page.setData({ nodes: [{ name: 'div', children: [{ type: 'text', text: 'Updated ' }, { name: 'strong', children: [{ text: '&amp;<literal>' }] }] }] })
      await check('#structured', 'Updated &amp;<literal>')
      page.setData({ 'nodes[0].children[0].text': 'Patched ' })
      await check('#structured', 'Patched &amp;<literal>')
      page.setData({ nodes: '<p>Replaced &amp; decoded</p>' })
      await check('#structured', 'Replaced & decoded')

      for (const nodes of ['', [], null, false, 42, {}, { name: 'p', children: null }, [null, 42, { children: false }]]) {
        page.setData({ nodes })
        await check('#structured', '')
        expect(await (await new HeadlessTestingNodeHandle(render().root).$('#structured'))!.wxml()).not.toContain('Replaced')
      }
      page.setData({ nodes: { name: 'unknown', children: [{ text: 'Restored' }] } })
      await check('#structured', 'Restored')
    }
    finally {
      session.close()
    }
  })

  it('keeps structured and HTML payloads inert instead of executing WXML or simulator metadata', async () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      for (const [nodes, expected] of [[untrustedRichText, untrustedRichTextContent], [untrustedRichTextHtml, untrustedRichTextHtmlContent]] as const) {
        page.setData({ nodes })
        const tree = provider === 'testing-fallback' ? renderPageTree(session.project, page) : session.renderCurrentPage()
        const root = new HeadlessTestingNodeHandle(tree.root, {
          callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
          createPageHandle: () => ({ data: async () => page.data }),
          createScopeHandle: () => null,
          ownerScopeId: () => null,
        })
        const rich = (await root.$('#structured'))!
        expect(await rich.text()).toBe(expected)
        // 富文本不是 WXML 声明节点；XPath 检查渲染内容，不伪造声明作用域来绕过 CSS 查询边界。
        const child = (await root.getElementsByXpath('//*[@id="untrusted-rich-child"]'))[0]!
        expect(await child.tagName()).toBe('p')
        expect(await child.attr('title')).toBe('{{secret}}')
        expect(await child.attr('data-state')).toBe('{{secret}}')
        for (const attribute of ['onclick', 'bindtap', 'wx:for', 'wx:if', 'data-sim-tap', 'data-sim-scope', 'data-sim-node', 'data-sim-component']) {
          expect(await child.attr(attribute)).toBeUndefined()
        }
        expect(await root.getElementsByXpath('//*[@id="structured"]//*[self::script or self::style or self::wxs or self::unsafe-card]')).toHaveLength(0)
        expect(await (await root.getElementsByXpath('//*[@id="structured"]//a'))[0]!.attr('href')).toBeUndefined()
        expect(await (await root.getElementsByXpath('//*[@id="structured"]//img'))[0]!.attr('src')).toBeUndefined()
        await expect(child.tap()).rejects.toThrow('No tap binding')
        expect(page.data.calls).toBe(0)
        expect(session.getApp()!.globalData.attached).toBe(0)
        const serialized = (await new HeadlessTestingNodeHandle(parseDocument(tree.wxml)).$('#structured'))!
        expect(await serialized.text()).toBe(expected)
        expect(await serialized.wxml()).not.toContain('<script>')
        await rich.tap()
      }
      expect(page.data.outerTaps).toBe(2)
    }
    finally {
      session.close()
    }
  })
})

it.each(['node', 'browser'] as const)('keeps registered rich-text custom components under %s component ownership', async (provider) => {
  const session = provider === 'browser'
    ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(richTextFiles) })
    : createHeadlessSession({ projectPath: createProject() })
  try {
    const page = session.reLaunch('/pages/custom/index')
    const read = async () => (await new HeadlessTestingNodeHandle(session.renderCurrentPage().root).$('#custom-content'))!.text()
    expect(await read()).toBe('custom:native content')
    page.setData({ nodes: [{ name: 'p', children: [{ type: 'text', text: 'updated' }] }] })
    expect(await read()).toBe('custom:updated')
  }
  finally {
    session.close()
  }
})

it('exposes materialized rich text through the public testing launch, XPath and snapshot APIs', async () => {
  const session = await launch({ projectPath: createProject() })
  try {
    const page = (await session.currentPage())!
    const [rich] = await page.getElementsByXpath('//*[@id="structured"]')
    expect(await rich!.text()).toBe('Rendered content')
    const snapshot = await page.snapshot()
    expect(snapshot.root.children[0]?.children.find(node => node.attrs.id === 'structured')).toMatchObject({
      tag: 'rich-text',
      text: 'Rendered content',
      children: [{ tag: 'p', text: 'Rendered content', children: [{ type: 'text', text: 'Rendered content' }] }],
    })
    await page.setData({ nodes: '<p>Updated &amp; decoded</p>' })
    expect(await (await page.$('#structured'))!.text()).toBe('Updated & decoded')
    expect((await page.snapshot()).wxml).toContain('<p>Updated &amp; decoded</p>')
    await page.setData({ nodes: null })
    expect(await (await page.$('#structured'))!.text()).toBe('')
  }
  finally {
    await session.close()
  }
})
