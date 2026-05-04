import { describe, expect, it } from 'vitest'
import { shouldFallbackToSmokeForChangedFiles } from '../../../scripts/audit-workspace-hmr'

describe('workspace HMR changed-file selection', () => {
  it('skips smoke fallback for test-only changes without runnable project impact', () => {
    expect(shouldFallbackToSmokeForChangedFiles([
      'packages/weapp-vite/test/tabbar-appbar.test.ts',
      'packages/weapp-vite/src/runtime/buildPlugin/pluginDemo.test.ts',
    ])).toBe(false)
  })

  it('keeps smoke fallback for global runtime and dependency changes', () => {
    expect(shouldFallbackToSmokeForChangedFiles(['packages/weapp-vite/src/createContext.ts'])).toBe(true)
    expect(shouldFallbackToSmokeForChangedFiles(['pnpm-lock.yaml'])).toBe(true)
  })

  it('keeps smoke fallback when changed files cannot be resolved', () => {
    expect(shouldFallbackToSmokeForChangedFiles([])).toBe(true)
  })
})
