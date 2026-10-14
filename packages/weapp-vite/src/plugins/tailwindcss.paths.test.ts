import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { realpathSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { createTailwindcssPlugin } from './tailwindcss'

vi.mock('../runtime/localPkg', () => ({
  safeGetPackageInfoSync: () => ({ version: '4.3.3' }),
}))

function hook<T extends (...args: any[]) => any>(value: T | { handler: T } | undefined) {
  return typeof value === 'function' ? value : value?.handler
}

afterEach(() => vi.restoreAllMocks())

it('does not resolve every module path while auto-detected Tailwind has no CSS entry', () => {
  const ctx = {
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
      platform: 'weapp',
      weappViteConfig: {},
    },
  } as CompilerContext
  const plugin: Plugin = createTailwindcssPlugin(ctx)[0]!
  const native = vi.spyOn(realpathSync, 'native')
  for (const id of ['/project/src/page.vue', '/project/src/helper.ts', '/project/src/plain.css']) {
    expect(hook(plugin.load)?.call({} as any, id)).toBeNull()
    expect(hook(plugin.transform)?.call({} as any, '/* ordinary module */', id, {} as any)).toBeNull()
    expect(hook(plugin.shouldTransformCachedModule)?.call({} as any, { id } as any)).toBeUndefined()
  }
  expect(native).not.toHaveBeenCalled()
})
