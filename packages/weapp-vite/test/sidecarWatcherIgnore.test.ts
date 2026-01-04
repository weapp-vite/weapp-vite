import path from 'pathe'
import { describe, expect, it } from 'vitest'

import { createSidecarIgnoredMatcher } from '@/plugins/utils/invalidateEntry'

function createCtx(root: string, options?: { dist?: string, outDir?: string }) {
  const cwd = root
  return {
    configService: {
      cwd,
      mpDistRoot: options?.dist,
      outDir: options?.outDir,
    },
  } as any
}

describe('createSidecarIgnoredMatcher', () => {
  it('ignores default folders inside root', () => {
    const root = path.normalize('/project/app')
    const ctx = createCtx(root)
    const matcher = createSidecarIgnoredMatcher(ctx, root)

    expect(matcher(path.join(root, 'node_modules', 'foo', 'bar.json'))).toBe(true)
    expect(matcher(path.join(root, '.wevu-config', 'temp.ts'))).toBe(true)
    expect(matcher(path.join(root, '.git', 'config'))).toBe(true)
    expect(matcher(path.join(root, 'src', 'pages', 'index.json'))).toBe(false)
  })

  it('ignores dist directories resolved from config', () => {
    const root = path.normalize('/project/app')
    const ctx = createCtx(root, { dist: 'dist', outDir: 'custom-dist' })
    const matcher = createSidecarIgnoredMatcher(ctx, root)

    expect(matcher(path.join(root, 'dist', 'app.json'))).toBe(true)
    expect(matcher(path.join(root, 'custom-dist', 'foo.wxml'))).toBe(true)
  })

  it('ignores absolute dist path outside root', () => {
    const root = path.normalize('/project/app')
    const ctx = createCtx(root, { dist: '../dist' })
    const matcher = createSidecarIgnoredMatcher(ctx, root)
    expect(matcher(path.normalize('/project/dist/app.json'))).toBe(true)
  })
})
