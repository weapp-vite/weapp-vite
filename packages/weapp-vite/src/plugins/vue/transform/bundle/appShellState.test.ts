import type { VueBundleState } from './shared'
import { describe, expect, it } from 'vitest'
import { resolveVueBundleEmitState } from './index'

describe('bundle app shell input ownership', () => {
  const shell = {
    file: '/project/src/__weapp_vite_app_shell',
    importPath: '/__weapp_vite_app_shell',
    tagName: 'weapp-app-shell',
  }

  it.each([true, false])('keeps current source metadata when the app cache belongs to the previous generation (hasShell=%s)', (hasShell) => {
    const state = {
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        },
        scanService: {},
      },
      appShell: hasShell ? shell : undefined,
      compilationCache: new Map([
        ['/project/src/app.vue', { result: { template: hasShell ? undefined : '<view><slot /></view>' }, isPage: false }],
        ['/project/src/pages/index/index.vue', { result: { template: '<view>page</view>' }, isPage: true }],
      ]),
    } as unknown as VueBundleState

    expect(resolveVueBundleEmitState(state)?.compilationEntries).toHaveLength(2)
    expect(state.appShell).toBe(hasShell ? shell : undefined)
  })
})
