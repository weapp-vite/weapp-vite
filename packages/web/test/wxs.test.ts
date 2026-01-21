import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { transformWxsToEsm } from '../src/compiler/wxs'
import { weappWebPlugin } from '../src/plugin'

describe('wxs compile', () => {
  it('adds wxs query for ts sources', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: '<wxs module="util" src="./utils.ts" />',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => '/src/pages/index/utils.ts',
    })

    expect(result.code).toContain(`import __wxs_0 from './utils.ts?wxs'`)
  })

  it('warns on duplicate module names', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: `
        <wxs module="util">var a = 1</wxs>
        <wxs module="util">var b = 2</wxs>
      `,
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })

    expect(result.warnings?.some(warning => warning.includes('WXS 模块名重复'))).toBe(true)
  })
})

describe('transformWxsToEsm', () => {
  it('warns on unsupported or missing require targets', () => {
    const result = transformWxsToEsm(
      `const foo = require('foo')\nconst bar = require('./missing')`,
      '/src/foo.wxs',
      {
        resolvePath: () => undefined,
      },
    )

    expect(result.warnings?.some(warning => warning.includes('仅支持相对或绝对路径'))).toBe(true)
    expect(result.warnings?.some(warning => warning.includes('无法解析 WXS require'))).toBe(true)
    expect(result.code).toContain('WXS require 未解析')
  })

  it('marks plain ts/js requires with wxs query', () => {
    const result = transformWxsToEsm(
      `const foo = require('./dep')`,
      '/src/foo.wxs',
      {
        resolvePath: () => '/src/dep.ts',
        toImportPath: resolved => resolved,
      },
    )

    expect(result.code).toContain(`import __wxs_dep_0 from '/src/dep.ts?wxs'`)
  })
})

describe('weappWebPlugin wxs resolution', () => {
  it('prefers .wxs over .ts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-wxs-'))
    const srcRoot = join(root, 'src')
    await mkdir(srcRoot, { recursive: true })

    const entry = join(srcRoot, 'index.wxs')
    const depWxs = join(srcRoot, 'dep.wxs')
    const depTs = join(srcRoot, 'dep.ts')

    await writeFile(entry, `const dep = require('./dep')`)
    await writeFile(depWxs, `module.exports = { value: 1 }`)
    await writeFile(depTs, `module.exports = { value: 2 }`)

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await plugin.configResolved?.call({ warn() {} } as any, { root, command: 'build' } as any)

    const transform = plugin.transform as (code: string, id: string) => Promise<{ code: string } | null>
    const result = await transform.call({ addWatchFile() {}, warn() {} }, await readFile(entry, 'utf8'), entry)

    expect(result?.code).toContain(`import __wxs_dep_0 from 'dep.wxs'`)
  })

  it('falls back to ts when wxs is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-wxs-'))
    const srcRoot = join(root, 'src')
    await mkdir(srcRoot, { recursive: true })

    const entry = join(srcRoot, 'index.wxs')
    const depTs = join(srcRoot, 'dep.ts')

    await writeFile(entry, `const dep = require('./dep')`)
    await writeFile(depTs, `module.exports = { value: 2 }`)

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await plugin.configResolved?.call({ warn() {} } as any, { root, command: 'build' } as any)

    const transform = plugin.transform as (code: string, id: string) => Promise<{ code: string } | null>
    const result = await transform.call({ addWatchFile() {}, warn() {} }, await readFile(entry, 'utf8'), entry)

    expect(result?.code).toContain(`import __wxs_dep_0 from 'dep.ts?wxs'`)
  })
})
