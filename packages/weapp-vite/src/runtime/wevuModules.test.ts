import { describe, expect, it } from 'vitest'
import {
  isWevuOwnedModuleId,
  isWevuStableVendorFileName,
  resolveWevuPreservedModulePath,
  resolveWevuRuntimeModuleFamily,
  resolveWevuRuntimeModuleId,
  resolveWevuRuntimeModuleIdFromStableVendorFileName,
  resolveWevuStableVendorFileName,
} from './wevuModules'

describe('wevu module identity', () => {
  it('recognizes workspace source and preserved package modules', () => {
    expect(resolveWevuRuntimeModuleId(
      '/project/packages-runtime/wevu/src/internal-runtime.ts',
    )).toBe('wevu/internal-runtime')
    expect(resolveWevuRuntimeModuleId(
      '/project/node_modules/.pnpm/wevu@1.0.0/node_modules/wevu/dist/dev/internal-reactivity.mjs',
    )).toBe('wevu/internal-reactivity')
    expect(resolveWevuRuntimeModuleFamily(
      '/project/packages-runtime/wevu/dist/runtime/app.mjs',
    )).toBe('runtime')
    expect(resolveWevuRuntimeModuleFamily(
      'C:\\project\\node_modules\\wevu\\dist\\dev\\runtime\\template.mjs?import',
    )).toBe('template')
    expect(resolveWevuRuntimeModuleFamily(
      '/project/node_modules/wevu/dist/router/createRouter.mjs',
    )).toBe('router')
  })

  it('keeps legacy hashed chunks on the legacy resolver path', () => {
    expect(resolveWevuPreservedModulePath(
      '/project/node_modules/wevu/dist/dev/watch-B46crqgs.mjs',
    )).toBeUndefined()
    expect(resolveWevuRuntimeModuleFamily(
      '/project/node_modules/wevu/dist/ref-Cs1oSrNU.mjs',
    )).toBeUndefined()
    expect(resolveWevuRuntimeModuleFamily(
      '/project/node_modules/wevu/dist/watch-abcdefgh.mjs',
    )).toBeUndefined()
    expect(resolveWevuRuntimeModuleFamily(
      '/project/node_modules/wevu/dist/internal-template.mjs',
    )).toBe('template')
  })

  it('recognizes hashed wevu ownership without claiming adjacent packages', () => {
    expect(isWevuOwnedModuleId('wevu')).toBe(true)
    expect(isWevuOwnedModuleId('wevu/router')).toBe(true)
    expect(isWevuOwnedModuleId(
      '/project/node_modules/wevu/dist/runtime-BD3I133J.mjs',
    )).toBe(true)
    expect(isWevuOwnedModuleId(
      '/project/node_modules/.pnpm/wevu@6.25.1/node_modules/wevu/dist/dev/watch-B46crqgs.mjs',
    )).toBe(true)
    expect(isWevuOwnedModuleId(
      '/project/packages-runtime/wevu/dist/src-BD3I133J.mjs',
    )).toBe(true)
    expect(isWevuOwnedModuleId(
      '/project/node_modules/.pnpm/@wevu+web-apis@1.0.0/node_modules/@wevu/web-apis/dist/index.mjs',
    )).toBe(false)
    expect(isWevuOwnedModuleId(
      '/project/node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/dayjs.min.js',
    )).toBe(false)
    expect(isWevuOwnedModuleId(
      '/project/node_modules/wevu/node_modules/dayjs/index.js',
    )).toBe(false)
    expect(isWevuOwnedModuleId(
      '/project/packages-runtime/wevu/node_modules/dayjs/index.js',
    )).toBe(false)
  })

  it('returns stable vendor names for every preserved module family', () => {
    expect(resolveWevuStableVendorFileName(
      '/project/node_modules/wevu/dist/dev/internal-runtime.mjs',
    )).toBe('weapp-vendors/wevu-runtime.js')
    expect(resolveWevuStableVendorFileName(
      '/project/packages-runtime/wevu/src/reactivity/watch.ts',
    )).toBe('weapp-vendors/wevu-reactivity.js')
    expect(isWevuStableVendorFileName('weapp-vendors/wevu-template.js')).toBe(true)
    expect(isWevuStableVendorFileName('common.js')).toBe(false)
    expect(resolveWevuRuntimeModuleIdFromStableVendorFileName(
      'weapp-vendors/wevu-runtime.js',
    )).toBe('wevu/internal-runtime')
    expect(resolveWevuRuntimeModuleIdFromStableVendorFileName(
      'weapp-vendors/wevu-reactivity.js',
    )).toBe('wevu/internal-reactivity')
    expect(resolveWevuRuntimeModuleIdFromStableVendorFileName('common.js')).toBeUndefined()
  })
})
