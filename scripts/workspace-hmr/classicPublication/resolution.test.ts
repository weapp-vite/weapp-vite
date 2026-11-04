import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inspectClassicPublication } from '../classicPublication'
import { createClassicPublicationResolver } from './resolution'

describe('classic publication platform resolution', () => {
  it.each(['weapp', 'alipay'] as const)('keeps local components and explicit file resolution ahead of npm for %s', (platform) => {
    const files = new Set(['pages/card.js', 'pages/local.js', 'pages/local.json', 'pages/local/index.js', 'node_modules/card.js', 'miniprogram_npm/card.js'])
    const resolver = createClassicPublicationResolver(platform, file => files.has(file))
    expect(resolver.resolveComponent('pages/index.json', 'card')).toBe('pages/card')
    expect(resolver.resolveModule('pages/index.js', './local')).toBe('pages/local.js')
    expect(resolver.resolveModule('pages/index.js', '/pages/local.json')).toBe('pages/local.json')
    expect(() => resolver.resolveModule('pages/index.js', '../../outside.js')).toThrow('escapes')
    expect(() => resolver.resolveComponent('pages/index.json', '/../../outside')).toThrow('escapes')
    expect(resolver.resolveModule('pages/index.js', '@scope/library/../../outside')).toBeUndefined()
    expect(resolver.resolveModule('pages/index.js', 'node:fs')).toBeUndefined()
    expect(resolver.resolveModule('pages/index.js', 'library\\outside')).toBeUndefined()
  })

  it('resolves nearest nested and scoped packages before parent npm directories, with the platform default winning within a level', () => {
    const files = new Set([
      'node_modules/@scope/library/card.js',
      'sub/miniprogram_npm/@scope/library/card.js',
      'sub/node_modules/@scope/library/card.js',
      'sub/node_modules/@scope/library/node_modules/nested/index.js',
      'sub/node_modules/@scope/library/miniprogram_npm/nested/index.js',
    ])
    const resolver = createClassicPublicationResolver('alipay', file => files.has(file))
    expect(resolver.resolveComponent('sub/pages/index.json', '@scope/library/card')).toBe('sub/node_modules/@scope/library/card')
    files.delete('sub/node_modules/@scope/library/card.js')
    expect(resolver.resolveComponent('sub/pages/index.json', '@scope/library/card')).toBe('sub/miniprogram_npm/@scope/library/card')
    expect(resolver.resolveModule('sub/node_modules/@scope/library/card.js', 'nested')).toBe('sub/node_modules/@scope/library/node_modules/nested/index.js')
  })

  it('does not let a node_modules tree satisfy a missing weapp bare module or component', () => {
    const files = new Set(['node_modules/library/index.js', 'node_modules/@scope/ui/card.js'])
    const resolver = createClassicPublicationResolver('weapp', file => files.has(file))
    expect(resolver.resolveModule('pages/index.js', 'library')).toBeUndefined()
    expect(resolver.resolveComponent('pages/index.json', '@scope/ui/card')).toBe('pages/@scope/ui/card')
    files.add('miniprogram_npm/library/index.js')
    files.add('miniprogram_npm/@scope/ui/card.js')
    expect(resolver.resolveModule('pages/index.js', 'library')).toBe('miniprogram_npm/library/index.js')
    expect(resolver.resolveComponent('pages/index.json', '@scope/ui/card')).toBe('miniprogram_npm/@scope/ui/card')
  })

  it.each(['weapp', 'alipay'] as const)('resolves %s relative and root component directories after an explicit script stem', (platform) => {
    const files = new Set(['node_modules/antd-mini/es/Loading/index.js'])
    const resolver = createClassicPublicationResolver(platform, file => files.has(file))
    const owner = 'node_modules/antd-mini/es/Bubble/index.json'
    expect(resolver.resolveComponent(owner, '../Loading')).toBe('node_modules/antd-mini/es/Loading/index')
    expect(resolver.resolveComponent(owner, '/node_modules/antd-mini/es/Loading')).toBe('node_modules/antd-mini/es/Loading/index')
    files.add('node_modules/antd-mini/es/Loading.js')
    expect(resolver.resolveComponent(owner, '../Loading')).toBe('node_modules/antd-mini/es/Loading')
    expect(resolver.resolveComponent(owner, '../Missing')).toBe('node_modules/antd-mini/es/Missing')
  })

  it.each(['tt', 'swan', 'jd', 'xhs'] as const)('does not infer relative component directory support for %s', (platform) => {
    const resolver = createClassicPublicationResolver(platform, file => file === 'components/card/index.js')
    expect(resolver.resolveComponent('pages/index.json', '../components/card')).toBe('components/card')
    expect(resolver.resolveComponent('pages/index.json', '/components/card')).toBe('components/card')
  })
})

describe('complete alipay npm publication inspection', () => {
  let root: string
  const write = async (name: string, source: string) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await writeFile(path.join(root, name), source)
  }
  const writeEntry = async (entry: string) => {
    await write(`${entry}.js`, 'Component({});')
    await write(`${entry}.json`, '{}')
    await write(`${entry}.axml`, '<view/>')
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hmr-alipay-publication-'))
    await write('app.js', 'App({});')
    await write('app.json', JSON.stringify({ pages: ['pages/index'] }))
    await writeEntry('pages/index')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it.each(['node_modules', 'miniprogram_npm'])('checks component and script closure in the legal %s output mode', async (directory) => {
    await write('app.js', 'require("@scope/library"); App({});')
    await write('pages/index.json', JSON.stringify({ usingComponents: { card: '@scope/ui/card' } }))
    await writeEntry(`${directory}/@scope/ui/card`)
    await write(`${directory}/@scope/library/index.js`, 'module.exports = require("./internal.json");')
    await write(`${directory}/@scope/library/internal.json`, '{}')
    const evidence = await inspectClassicPublication(root, 'alipay')
    expect(evidence.checkedFileCount).toBe(evidence.files.length)
    expect(evidence.files.map(file => file.path)).toEqual(expect.arrayContaining([
      `${directory}/@scope/ui/card.axml`,
      `${directory}/@scope/library/internal.json`,
    ]))
    await rm(path.join(root, `${directory}/@scope/library/internal.json`))
    await expect(inspectClassicPublication(root, 'alipay')).rejects.toThrow('missing script dependency ./internal.json')
  })

  it('retains a genuine missing npm subpath failure even when the package root exists', async () => {
    await write('node_modules/antd-mini/es/Countdown/index.js', 'require("dayjs/plugin/duration");')
    await write('node_modules/dayjs/index.js', 'module.exports = {};')
    await expect(inspectClassicPublication(root, 'alipay')).rejects.toThrow('missing script dependency dayjs/plugin/duration from node_modules/antd-mini/es/Countdown/index.js')
    await write('node_modules/dayjs/plugin/duration.js', 'module.exports = {};')
    await expect(inspectClassicPublication(root, 'alipay')).resolves.toBeDefined()
    await write('node_modules/dayjs/plugin/duration.js', 'require("./missing.js");')
    await expect(inspectClassicPublication(root, 'alipay')).rejects.toThrow('missing script dependency ./missing.js from node_modules/dayjs/plugin/duration.js')
  })

  it.each(['node_modules', 'miniprogram_npm'])('checks relative directory component entries in %s without hiding missing companion files', async (directory) => {
    const stem = `${directory}/antd-mini/es/Loading/index`
    await writeEntry(`${directory}/antd-mini/es/Bubble/index`)
    await write(`${directory}/antd-mini/es/Bubble/index.json`, JSON.stringify({ usingComponents: { loading: '../Loading' } }))
    await writeEntry(stem)
    await expect(inspectClassicPublication(root, 'alipay')).resolves.toBeDefined()
    for (const extension of ['.js', '.json', '.axml']) {
      await rm(path.join(root, `${stem}${extension}`))
      await expect(inspectClassicPublication(root, 'alipay')).rejects.toThrow('Classic publication is missing')
      await writeEntry(stem)
    }
  })

  it.each(['.json', '.axml'])('does not replace an incomplete explicit component stem with a complete directory entry when %s is missing', async (extension) => {
    const stem = 'node_modules/antd-mini/es/Loading'
    await writeEntry('node_modules/antd-mini/es/Bubble/index')
    await write('node_modules/antd-mini/es/Bubble/index.json', JSON.stringify({ usingComponents: { loading: '../Loading' } }))
    await writeEntry(stem)
    await writeEntry(`${stem}/index`)
    await rm(path.join(root, `${stem}${extension}`))
    await expect(inspectClassicPublication(root, 'alipay')).rejects.toThrow(`Classic publication is missing ${stem}${extension}`)
  })
})
