import type { MutableCompilerContext } from '../../context'
import { describe, expect, it } from 'vitest'
import { createManagedTsconfigFiles } from './index'

describe('managed React JSX types', () => {
  it.each([true, { renderMode: 'auto' }])('keeps React JSX ownership with Wevu interop (%j)', async (react) => {
    const files = await createManagedTsconfigFiles({
      configService: {
        cwd: '/project',
        configFilePath: '/project/vite.config.ts',
        packageJson: { dependencies: { wevu: '^7.0.0', react: '^19.0.0' } },
        weappViteConfig: { platform: 'weapp', react },
      },
    } as unknown as MutableCompilerContext)
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content) as {
      compilerOptions: { jsxImportSource: string }
      vueCompilerOptions: { lib: string }
    }

    expect(app.compilerOptions.jsxImportSource).toBe('react')
    expect(app.vueCompilerOptions.lib).toBe('wevu')
    const bridge = files.find(file => file.path.endsWith('tsconfig.shared.empty.d.ts'))!.content
    expect(bridge).toContain('from \'wevu/weapp/jsx-runtime\'')
    expect(bridge).toContain('declare module \'wevu/jsx-runtime\'')
    expect(bridge).not.toContain('declare module \'react')
  })

  it('selects React types without a Wevu dependency', async () => {
    const files = await createManagedTsconfigFiles({
      configService: {
        cwd: '/project',
        configFilePath: '/project/vite.config.ts',
        packageJson: { dependencies: { react: '^19.0.0' } },
        weappViteConfig: { platform: 'weapp', react: true },
      },
    } as unknown as MutableCompilerContext)
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content) as {
      compilerOptions: { jsxImportSource: string }
    }
    expect(app.compilerOptions.jsxImportSource).toBe('react')
    expect(files.find(file => file.path.endsWith('tsconfig.shared.empty.d.ts'))!.content).toBe('export {}\n')
  })
})
