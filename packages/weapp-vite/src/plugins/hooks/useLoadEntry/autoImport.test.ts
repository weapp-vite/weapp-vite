import { describe, expect, it, vi } from 'vitest'
import { createAutoImportAugmenter } from './autoImport'

describe('createAutoImportAugmenter', () => {
  it('injects usingComponents when tag name matches resolver key', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'Navbar') {
        return {
          value: {
            name: 'Navbar',
            from: '/components/Navbar/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve } as any,
      {
        wxmlComponentsMap: new Map([
          ['/project/src/pages/index/index', { Navbar: [{ start: 0, end: 0 }] }],
        ]),
      } as any,
    )

    const json: Record<string, any> = {}
    applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('Navbar', '/project/src/pages/index/index')
    expect(json.usingComponents).toEqual({
      Navbar: '/components/Navbar/index',
    })
  })

  it('does not inject usingComponents when tag name case mismatches', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'navbar') {
        return {
          value: {
            name: 'navbar',
            from: '/components/navbar/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve } as any,
      {
        wxmlComponentsMap: new Map([
          ['/project/src/pages/index/index', { Navbar: [{ start: 0, end: 0 }] }],
        ]),
      } as any,
    )

    const json: Record<string, any> = {}
    applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('Navbar', '/project/src/pages/index/index')
    expect(json.usingComponents).toBeUndefined()
  })
})
