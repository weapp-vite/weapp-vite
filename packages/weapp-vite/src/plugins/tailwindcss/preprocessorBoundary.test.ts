import type { CompilerContext } from '../../context'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createTailwindcssPlugin } from '../tailwindcss'

describe('Tailwind import ownership before style preprocessing', () => {
  it.each(['scss', 'sass', 'less', 'styl', 'stylus', 'sss'])('leaves raw %s imports to the owning preprocessor', async (extension) => {
    const root = path.resolve('style-preprocessor-fixture')
    const manager = createTailwindcssPlugin({
      configService: {
        cwd: root,
        absoluteSrcRoot: path.join(root, 'src'),
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
        weappViteConfig: { tailwindcss: { cssEntries: [path.join(root, 'src/app.css')] } },
      },
      runtimeState: createRuntimeState(),
    } as unknown as CompilerContext)[0]!
    const transform = typeof manager.transform === 'function' ? manager.transform : manager.transform!.handler
    const resolve = vi.fn()
    const source = '// preprocessor-owned comment\n@import "./tokens";\n'
    expect(await transform.call({ resolve } as any, source, path.join(root, `src/page.${extension}`), {} as any)).toBeNull()
    expect(resolve).not.toHaveBeenCalled()
  })
})
