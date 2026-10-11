import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { captureHmrStyleFailure } from './hmrStyleDiagnostics'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

const directories: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  vi.mocked(appendIdeReportEvent).mockReset()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('preserves native matching rules separately from emitted CSS and checks the observed page before CSS inspection', async () => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hmr-style-diagnostic-'))
  directories.push(directory)
  const stylesheet = path.join(directory, 'page.wxss')
  const source = '.new-class { background: green }'
  await writeFile(stylesheet, source)
  const matched = { matchedCSSRules: [{ rule: { selectorList: { text: '.old-class' }, style: { cssText: 'background: blue' } }, matchingSelectors: [0] }] }
  const responses: Record<string, unknown> = {
    'App.getCurrentPage': { pageId: 7, path: 'pages/index/index', unrelated: 'omitted' },
    'Page.getElement': { elementId: '42', tagName: 'view' },
    'Element.getAttributes': { attributes: ['new-class'] },
    'Element.getStyles': { styles: ['rgba(0, 0, 0, 0)', 'rgb(0, 0, 0)'] },
    'App.CDPCommand': matched,
  }
  const send = vi.fn(async (method: string) => responses[method])
  const result = await captureHmrStyleFailure({ send }, {
    project: 'fixture',
    selector: '#utility',
    stylesheets: [{ fileName: 'pages/index/index.wxss', path: stylesheet }],
  })
  expect(result).toMatchObject({
    page: { pageId: 7, path: 'pages/index/index' },
    attributes: { attributes: ['new-class'] },
    computedStyles: { styles: ['rgba(0, 0, 0, 0)', 'rgb(0, 0, 0)'] },
    matchedStyles: matched,
    stylesheets: [{ fileName: 'pages/index/index.wxss', bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex') }],
    errors: [],
  })
  expect(send.mock.calls).toEqual([
    ['App.getCurrentPage', {}, { timeout: 1_000 }],
    ['Page.getElement', { pageId: 7, selector: '#utility' }, { timeout: 1_000 }],
    ['Element.getAttributes', { pageId: 7, elementId: '42', names: ['class'] }, { timeout: 1_000 }],
    ['Element.getStyles', { pageId: 7, elementId: '42', names: ['background-color', 'color'] }, { timeout: 1_000 }],
    ['App.CDPCommand', { domain: 'CSS', method: 'getMatchedStylesForNode', params: { nodeId: 42 } }, { timeout: 1_000 }],
  ])
  const report = JSON.stringify(vi.mocked(appendIdeReportEvent).mock.calls)
  expect(report).not.toContain(directory)
  expect(report).not.toContain('unrelated')
})

it('retains unsupported-protocol evidence without throwing or requesting another page', async () => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const send = vi.fn(async (method: string) => {
    if (method === 'App.getCurrentPage') {
      return { pageId: 2, path: 'pages/index/index' }
    }
    if (method === 'Page.getElement') {
      return { elementId: '5', tagName: 'view' }
    }
    if (method === 'Element.getAttributes') {
      return { attributes: ['new-class'] }
    }
    throw new TypeError('private protocol path')
  })
  const result = await captureHmrStyleFailure({ send }, { project: 'fixture', selector: '#utility', stylesheets: [] })
  expect(result.errors).toEqual(['Element.getStyles: TypeError', 'App.CDPCommand: TypeError'])
  expect(result.matchedStyles).toBeNull()
  expect(send).toHaveBeenCalledTimes(5)
  expect(JSON.stringify(result)).not.toContain('private protocol path')
})

it('does not inspect a possibly unrelated tree when both page-identity checks fail', async () => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const send = vi.fn(async (method: string) => {
    if (method === 'App.getCurrentPage') {
      return { pageId: 2, path: 'pages/index/index' }
    }
    if (method === 'Page.getElement') {
      return { elementId: '5', tagName: 'view' }
    }
    throw new Error('unavailable page')
  })
  const result = await captureHmrStyleFailure({ send }, { project: 'fixture', selector: '#utility', stylesheets: [] })
  expect(result.matchedStyles).toBeNull()
  expect(result.errors).toEqual(['Element.getAttributes: Error', 'Element.getStyles: Error'])
  expect(send).not.toHaveBeenCalledWith('App.CDPCommand', expect.anything(), expect.anything())
})

it('keeps the original test failure intact when both diagnostic report sinks fail', async () => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => {
    throw new Error('private stdout error')
  })
  vi.mocked(appendIdeReportEvent).mockImplementation(() => {
    throw new TypeError('private filesystem error')
  })
  const result = await captureHmrStyleFailure({ send: async () => null }, { project: 'fixture', selector: '#utility', stylesheets: [] })
  expect(result.errors).toEqual(['report sink: TypeError', 'stdout: Error'])
  expect(JSON.stringify(result)).not.toContain('private')
})

it.each([null, { pageId: 2, path: 'pages/index/index' }])('stops inspection if no valid native node is available (%j)', async (page) => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const send = vi.fn(async (method: string) => method === 'App.getCurrentPage' ? page : { elementId: 'not-a-node' })
  const result = await captureHmrStyleFailure({ send }, { project: 'fixture', selector: '#utility', stylesheets: [] })
  expect(result.matchedStyles).toBeNull()
  expect(send.mock.calls.map(([method]) => method)).toEqual(page ? ['App.getCurrentPage', 'Page.getElement'] : ['App.getCurrentPage'])
})
