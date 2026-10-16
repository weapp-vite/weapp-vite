import type { VueBundleState } from './shared'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveVueBundleEmitState } from './index'

describe('bundle app shell input ownership', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'weapp-shell-state-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it.each([true, false])('keeps current source metadata when the app cache belongs to the previous generation (hasShell=%s)', (hasShell) => {
    const shell = {
      file: path.join(root, '__weapp_vite_app_shell'),
      importPath: '/__weapp_vite_app_shell',
      tagName: 'weapp-app-shell',
    }
    const state = {
      ctx: {
        configService: {
          absoluteSrcRoot: root,
          relativeOutputPath: (value: string) => path.relative(root, value).split(path.sep).join('/'),
        },
        scanService: {},
      },
      appShell: hasShell ? shell : undefined,
      compilationCache: new Map([
        [path.join(root, 'app.vue'), { result: { template: hasShell ? undefined : '<view><slot /></view>' }, isPage: false }],
        [path.join(root, 'pages/index/index.vue'), { result: { template: '<view>page</view>' }, isPage: true }],
      ]),
    } as unknown as VueBundleState

    expect(resolveVueBundleEmitState(state)?.compilationEntries).toHaveLength(2)
    expect(state.appShell).toBe(hasShell ? shell : undefined)
  })
})
