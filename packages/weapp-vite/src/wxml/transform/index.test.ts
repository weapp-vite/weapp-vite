import type { CompilerContext } from '../../context'
import type { WxmlTransform, WxmlTransformContext } from '../../types'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { transformWxml } from './index'

function context(transform?: WxmlTransform | WxmlTransform[]) {
  return {
    runtimeState: createRuntimeState(),
    configService: {
      cwd: '.',
      platform: 'weapp',
      mode: 'production',
      isDev: false,
      weappViteConfig: { wxml: { transform } },
    },
  } as unknown as CompilerContext
}

const run = (transform?: WxmlTransform | WxmlTransform[]) => transformWxml(context(transform), '<view/>', 'sub/page.wxml', 'legacy', () => {}, () => {}, 'sub')

describe('WXML transform callbacks', () => {
  it('awaits composition and distinguishes no change from empty output', async () => {
    const order: number[] = []
    expect(await run([
      async (code) => {
        await Promise.resolve()
        order.push(1)
        return `${code}<!-- added -->`
      },
      (code) => {
        order.push(2)
        expect(code).toContain('added')
        return null
      },
      () => undefined,
      () => '',
      (code) => {
        expect(code).toBe('')
        return '<text/>'
      },
    ])).toBe('<text/>')
    expect(order).toEqual([1, 2])
    expect(await run()).toBe('<view/>')
    expect(await run([])).toBe('<view/>')
  })

  it('allows raw source replacement without protected-node validation', async () => {
    expect(await run(() => '<slot/>')).toBe('<slot/>')
    expect(await run(() => '<unclosed')).toBe('<unclosed')
  })

  it('provides frozen context and edits with file diagnostics', async () => {
    let retained: WxmlTransformContext | undefined
    const add = vi.fn()
    const warn = vi.fn()
    const ctx = context((code, options) => {
      retained = options
      expect(Object.isFrozen(options)).toBe(true)
      expect(options).toMatchObject({ fileName: 'sub/page.wxml', platform: 'weapp', mode: 'production', isDev: false, subPackageRoot: 'sub' })
      options.addWatchFile('rules.json')
      options.warn('a diagnostic')
      return options.edit(code, node => node.setAttribute('title', 'edited'))
    })
    expect(await transformWxml(ctx, '<view/>', 'sub/page.wxml', 'legacy', add, warn, 'sub')).toBe('<view title="edited"/>')
    expect(add).toHaveBeenCalledWith('rules.json')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sub/page.wxml (callback 1): a diagnostic'))
    expect(() => retained!.addWatchFile('late.json')).toThrow('already completed')
  })

  it('reports callback index and original cause for async errors and invalid returns', async () => {
    const cause = new Error('rule unavailable')
    await expect(run([code => code, async () => {
      throw cause
    }])).rejects.toMatchObject({
      message: expect.stringContaining('sub/page.wxml (callback 2): rule unavailable'),
      cause,
    })
    await expect(run((() => false) as unknown as WxmlTransform)).rejects.toThrow('Expected a string, null, or undefined')
    await expect(run([null] as unknown as WxmlTransform[])).rejects.toThrow('Expected a transform function')
  })
})
