import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { replaceEntryStyleImports } from './cssSidecarOwnership'
import { createRuntimeState } from './runtimeState'

describe('entry style scan ownership', () => {
  const owner = path.resolve('src/pages/index/index.vue')
  const otherOwner = path.resolve('src/pages/index/index.ts')
  const style = path.resolve('src/pages/index/index.wxss')
  const replacement = path.resolve('src/pages/index/index.css')

  it('replaces previous scans while preserving another owner and an empty scan result', () => {
    const { css } = createRuntimeState()
    replaceEntryStyleImports(css, owner, [style])
    replaceEntryStyleImports(css, otherOwner, [style])
    css.transformedSidecarSource.set(style, { code: '.compiled {}', diskSource: '.source {}' })

    replaceEntryStyleImports(css, owner, [replacement])
    expect(css.sidecarImports).toEqual(new Set([style, replacement]))
    expect(css.transformedSidecarSource.has(style)).toBe(true)

    replaceEntryStyleImports(css, otherOwner, [])
    expect(css.sidecarImports).toEqual(new Set([replacement]))
    expect(css.sidecarImportsByOwner.get(otherOwner)).toEqual(new Set())
    expect(css.transformedSidecarSource.has(style)).toBe(false)

    replaceEntryStyleImports(css, owner, [])
    expect(css.sidecarImports.size).toBe(0)
  })

  it('keeps replacement scans isolated between compiler contexts', () => {
    const first = createRuntimeState().css
    const second = createRuntimeState().css
    replaceEntryStyleImports(first, owner, [style])
    replaceEntryStyleImports(second, owner, [style])
    replaceEntryStyleImports(first, owner, [])
    expect(first.sidecarImports.size).toBe(0)
    expect(second.sidecarImports).toEqual(new Set([style]))
  })
})
