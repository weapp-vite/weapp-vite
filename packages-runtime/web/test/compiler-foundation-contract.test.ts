import { describe, expect, it } from 'vitest'
import {
  addDependency,
  createDependencyContext,
  warnCircularTemplate,
  warnReadTemplate,
} from '../src/compiler/wxml/dependency'
import { parseWxml } from '../src/compiler/wxml/parser'
import { transformWxsToEsm } from '../src/compiler/wxs'

describe('WXS transform edge contracts', () => {
  it('normalizes Windows imports, deduplicates requires and preserves existing queries', () => {
    const result = transformWxsToEsm(
      `const first = require('.\\dep')\nconst duplicate = require('.\\dep')`,
      'C:\\src\\entry.wxs',
      {
        resolvePath: request => request === './dep' ? 'C:\\src\\dep.ts' : undefined,
        toImportPath: () => 'C:\\src\\dep.ts?wxs',
      },
    )
    expect(result.dependencies).toEqual(['C:\\src\\dep.ts'])
    expect(result.code).toContain(`from 'C:/src/dep.ts?wxs'`)
    expect(result.code.match(/import __wxs_dep_/g)).toHaveLength(1)
    expect(result.warnings).toBeUndefined()
  })

  it('uses ampersand queries and leaves WXS modules unmarked', () => {
    const script = transformWxsToEsm(`require('/dep')`, '/entry.wxs', {
      resolvePath: () => '/dep.js',
      toImportPath: () => '/dep.js?raw',
    })
    expect(script.code).toContain(`from '/dep.js?raw&wxs'`)

    const wxs = transformWxsToEsm(`require('./dep')`, '/entry.wxs', {
      resolvePath: () => '/dep.wxs',
    })
    expect(wxs.code).toContain(`from '/dep.wxs'`)
    expect(wxs.code).not.toContain('/dep.wxs?wxs')
  })
})

describe('WXML dependency bookkeeping contracts', () => {
  it('deduplicates dependencies and warning records', () => {
    const context = createDependencyContext()
    const direct: string[] = []
    addDependency('/first.wxml', context, direct)
    addDependency('/first.wxml', context, direct)
    addDependency('/second.wxml', context)
    expect(context.dependencies).toEqual(['/first.wxml', '/second.wxml'])
    expect(direct).toEqual(['/first.wxml'])

    warnReadTemplate(context, '/missing.wxml')
    warnCircularTemplate(context, '/a.wxml', '/b.wxml')
    warnCircularTemplate(context, '/a.wxml', '/b.wxml')
    expect(context.warnings).toEqual([
      '[web] 无法读取模板依赖: /missing.wxml',
      '[web] WXML 循环引用: /a.wxml -> /b.wxml',
    ])
  })
})

describe('WXML parser node contracts', () => {
  it('filters directives, comments and whitespace while preserving supported nodes', () => {
    const nodes = parseWxml(`<?xml version="1.0"?><!-- comment -->\n<view id="root"> text <!-- nested --><script>code</script><style>.x{}</style></view>`)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'element',
      name: 'view',
      attribs: { id: 'root' },
      children: [
        { type: 'text', data: ' text ' },
        { type: 'element', name: 'script' },
        { type: 'element', name: 'style' },
      ],
    })
  })

  it('drops unsupported CDATA nodes and handles empty documents', () => {
    expect(parseWxml('<![CDATA[ignored]]><view />')).toEqual([
      expect.objectContaining({ type: 'element', name: 'view' }),
    ])
    expect(parseWxml('   <!-- empty -->')).toEqual([])
  })
})
