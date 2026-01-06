import { describe, expect, it } from 'vitest'
import { TDesignResolver } from '../../auto-import-components/resolvers'
import { createRuntimeState } from '../runtimeState'
import { createAutoImportService } from './service'

describe('autoImport service resolver normalization', () => {
  it('resolves PascalCase tags via kebab-case resolver entries', () => {
    const service = createAutoImportService({
      runtimeState: createRuntimeState(),
      configService: {
        cwd: '/project',
        currentSubPackageRoot: undefined,
        weappViteConfig: {
          autoImportComponents: {
            output: false,
            typedComponents: false,
            htmlCustomData: false,
            vueComponents: false,
            resolvers: [TDesignResolver()],
          },
        },
      },
    } as any)

    expect(service.resolve('t-button', '/project/src/pages/index/index')).toEqual({
      kind: 'resolver',
      value: {
        name: 't-button',
        from: 'tdesign-miniprogram/button/button',
      },
    })

    expect(service.resolve('TButton', '/project/src/pages/index/index')).toEqual({
      kind: 'resolver',
      value: {
        name: 'TButton',
        from: 'tdesign-miniprogram/button/button',
      },
    })
  })
})
