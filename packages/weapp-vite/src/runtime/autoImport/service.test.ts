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

  it('resolves local components across PascalCase and kebab-case filename styles', () => {
    const runtimeState = createRuntimeState()
    const kebabFileComponent = {
      kind: 'local' as const,
      entry: {
        path: '/project/src/components/v-button.vue',
        json: { component: true },
        jsonPath: '/project/src/components/v-button.vue',
        type: 'component' as const,
        templatePath: '/project/src/components/v-button.vue',
      },
      value: {
        name: 'v-button',
        from: '/components/v-button',
        resolvedId: '/project/src/components/v-button.vue',
      },
    }
    const pascalFileComponent = {
      kind: 'local' as const,
      entry: {
        path: '/project/src/components/VInput.vue',
        json: { component: true },
        jsonPath: '/project/src/components/VInput.vue',
        type: 'component' as const,
        templatePath: '/project/src/components/VInput.vue',
      },
      value: {
        name: 'VInput',
        from: '/components/VInput',
        resolvedId: '/project/src/components/VInput.vue',
      },
    }
    runtimeState.autoImport.registry.set('v-button', kebabFileComponent)
    runtimeState.autoImport.registry.set('VInput', pascalFileComponent)

    // 单元测试仅提供组件解析路径需要的最小编译上下文。
    const ctx = {
      runtimeState,
      configService: {
        cwd: '/project',
        currentSubPackageRoot: undefined,
        weappViteConfig: {
          autoImportComponents: {
            output: false,
            typedComponents: false,
            htmlCustomData: false,
            vueComponents: false,
          },
        },
      },
    } as unknown as Parameters<typeof createAutoImportService>[0]
    const service = createAutoImportService(ctx)

    expect(service.resolve('VButton')).toBe(kebabFileComponent)
    expect(service.resolve('v-input')).toBe(pascalFileComponent)

    const pascalCollisionComponent = {
      ...kebabFileComponent,
      entry: {
        ...kebabFileComponent.entry,
        path: '/project/src/components/VButton.vue',
        jsonPath: '/project/src/components/VButton.vue',
        templatePath: '/project/src/components/VButton.vue',
      },
      value: {
        name: 'VButton',
        from: '/components/VButton',
        resolvedId: '/project/src/components/VButton.vue',
      },
    }
    runtimeState.autoImport.registry.set('VButton', pascalCollisionComponent)
    const collisionService = createAutoImportService(ctx)

    expect(collisionService.resolve('v-button')).toBe(kebabFileComponent)
    expect(collisionService.resolve('VButton')).toBe(pascalCollisionComponent)
    expect(collisionService.resolve('vButton')).toBeUndefined()
  })
})
