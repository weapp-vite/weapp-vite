import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { WxmlElementInfo, WxmlValidate, WxmlValidationContext } from '../../types'
import { Buffer } from 'node:buffer'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import * as scanner from '../template/scan'
import { validateWxmlBundle } from './index'

function context(validate?: WxmlValidate | WxmlValidate[]) {
  const root = path.join(os.tmpdir(), 'wxml-validation')
  return {
    configService: { cwd: root, outDir: path.join(root, 'dist'), platform: 'weapp', mode: 'production', isDev: false, weappViteConfig: { wxml: { validate } } },
    runtimeState: createRuntimeState(),
  } as unknown as CompilerContext
}

function bundle(...sources: string[]): OutputBundle {
  return Object.fromEntries(sources.map((source, index) => [`pages/${index}.wxml`, { type: 'asset', fileName: `pages/${index}.wxml`, source: Buffer.from(source) }])) as OutputBundle
}

const hooks = () => ({ warn: vi.fn(), addWatchFile: vi.fn(), partial: false })

describe('final WXML validation', () => {
  it('does not scan disabled, empty or source-only validators', async () => {
    const scan = vi.spyOn(scanner, 'scanTemplate')
    try {
      for (const validate of [undefined, [], (code: string) => {
        expect(code).toBe('<invalid')
      }] as const) {
        await validateWxmlBundle(context(validate as WxmlValidate), bundle('<invalid'), hooks())
      }
      expect(scan).not.toHaveBeenCalled()
    }
    finally {
      scan.mockRestore()
    }
  })

  it('shares one scan and immutable observations across ordered asynchronous callbacks', async () => {
    const scan = vi.spyOn(scanner, 'scanTemplate')
    const source = '<!-- keep -->\r\n<view a="&amp;" flag><text value="hello {{name}}"/><wxs module="x">var tag="<text/>";</wxs></view>'
    const seen: string[] = []
    const first: WxmlElementInfo[] = []
    let retained: WxmlValidationContext | undefined
    const ctx = context([
      async (code, options) => {
        expect(code).toBe(source)
        expect(options).toMatchObject({ fileName: 'pages/0.wxml', platform: 'weapp', mode: 'production', isDev: false, subPackageRoot: 'sub' })
        retained = options
        await options.walk(async (node) => {
          await Promise.resolve()
          seen.push(node.tagName)
          first.push(node)
          expect(Object.isFrozen(node)).toBe(true)
          expect(Object.isFrozen(node.attributes)).toBe(true)
          expect(Object.isFrozen(node.location)).toBe(true)
          expect(node).not.toHaveProperty('remove')
        })
      },
      async (_, options) => {
        let index = 0
        await options.walk((node) => {
          expect(node).toBe(first[index++])
        })
      },
    ])
    try {
      await validateWxmlBundle(ctx, bundle(source), hooks(), 'sub')
      expect(scan).toHaveBeenCalledTimes(1)
      expect(seen).toEqual(['view', 'text', 'wxs'])
      expect(first[0]?.location).toEqual({ offset: 15, line: 2, column: 1 })
      expect(first[0]?.getAttribute('a')).toEqual({ name: 'a', rawValue: '&amp;', quote: '"' })
      expect(first[0]?.getAttribute('flag')?.rawValue).toBeNull()
      expect(first[1]?.parent).toBe(first[0])
      expect(first[1]?.getAttribute('value')?.rawValue).toBe('hello {{name}}')
      expect(() => retained!.report({ severity: 'warning', message: 'late' })).toThrow('completed')
      expect(() => retained!.addWatchFile('late.json')).toThrow('completed')
      await expect(retained!.walk(() => {})).rejects.toThrow('completed')
    }
    finally {
      scan.mockRestore()
    }
  })

  it('aggregates errors across templates and callbacks, deduplicates identical reports and leaves outputs intact', async () => {
    const ctx = context([
      async (_, options) => options.walk((node) => {
        const diagnostic = { severity: 'error' as const, code: 'no-debug', message: '禁止调试节点', location: node.location }
        options.report(diagnostic)
        options.report(diagnostic)
        options.report({ severity: 'warning', message: '检查完成' })
      }),
      (_, options) => {
        options.report({ severity: 'error', message: '第二条规则' })
      },
    ])
    const output = bundle('<debug/>', '<debug/>')
    const original = bundle('<debug/>', '<debug/>')
    const plugin = hooks()
    const failure = await validateWxmlBundle(ctx, output, plugin).catch(error => error as Error)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toContain('4 validation error(s)')
    expect((failure as Error).message).toContain('pages/1.wxml:1:1 (callback 1) [no-debug]')
    expect((failure as Error).message).toContain('pages/1.wxml (callback 2)')
    expect(plugin.warn).toHaveBeenCalledTimes(2)
    expect(output).toEqual(original)
  })

  it('allows warning-only output and attaches the original callback failure', async () => {
    const plugin = hooks()
    await validateWxmlBundle(context((_, ctx) => ctx.report({ severity: 'warning', message: 'warning only' })), bundle('<view/>'), plugin)
    expect(plugin.warn).toHaveBeenCalledWith(expect.stringContaining('warning only'))
    const cause = new Error('remote rule unavailable')
    const later = vi.fn()
    await expect(validateWxmlBundle(context([async () => {
      throw cause
    }, later]), bundle('<view/>'), hooks()))
      .rejects
      .toMatchObject({ cause, message: expect.stringContaining('pages/0.wxml (callback 1): remote rule unavailable') })
    expect(later).not.toHaveBeenCalled()
  })

  it.each([null, '', false, {}])('rejects non-undefined result %j', async (result) => {
    await expect(validateWxmlBundle(context((() => result) as WxmlValidate), bundle('<view/>'), hooks())).rejects.toThrow('Expected an undefined validation result')
  })

  it('rejects invalid callbacks, diagnostics, visitors and malformed templates with a filename', async () => {
    const cases: Array<[WxmlValidate | WxmlValidate[], string]> = [
      [[null] as unknown as WxmlValidate[], 'Expected a validation function'],
      [(_, ctx) => ctx.report({ severity: 'error', message: '' }), 'nonempty message'],
      [(_, ctx) => ctx.report({ severity: 'error', message: 'bad', location: { offset: 0, line: 0, column: 1 } }), 'positive line/column'],
      [async (_, ctx) => ctx.walk(null as any), 'visitor function'],
      [async (_, ctx) => ctx.walk(() => {}), 'pages/0.wxml'],
    ]
    for (const [validate, message] of cases) {
      await expect(validateWxmlBundle(context(validate), bundle('<view'), hooks())).rejects.toThrow(message)
    }
  })

  it.each(['weapp', 'alipay', 'tt'] as const)('uses %s lexical boundaries without interpreting bindings', async (platform) => {
    const source = platform === 'weapp' ? String.raw`<view value="a\"b {{value}}"/>` : '<view value="a&quot;b {{value}}"/>'
    const ctx = context(async (_, options) => options.walk((node) => {
      expect(node.getAttribute('value')?.rawValue).toContain('{{value}}')
      expect(node.hasAttribute('value')).toBe(true)
    }))
    ctx.configService.platform = platform
    await validateWxmlBundle(ctx, bundle(source), hooks())
  })
})
