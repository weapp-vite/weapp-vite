import type { AutoRoutes } from './types/routes'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('auto-routes module exports', () => {
  const modulePath = './auto-routes'

  afterEach(() => {
    vi.doUnmock('./context')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('mirrors data from the active auto routes service reference', async () => {
    const reference: AutoRoutes = {
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [
        {
          root: 'packageA',
          pages: ['pages/dog'],
        },
      ],
    }

    const getReference = vi.fn(() => reference)

    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({
          autoRoutesService: {
            getReference,
          },
        }),
      }
    })

    const module = await import(modulePath)

    expect(getReference).toHaveBeenCalled()
    expect(module.routes.pages).toBe(reference.pages)
    expect(module.routes.entries).toBe(reference.entries)
    expect(module.routes.subPackages).toBe(reference.subPackages)

    // Ensure the named exports surface the same live references.
    expect(module.pages).toBe(reference.pages)
    expect(module.entries).toBe(reference.entries)
    expect(module.subPackages).toBe(reference.subPackages)

    reference.pages.push('pages/about/index')
    expect(module.pages).toContain('pages/about/index')
    expect(module.routes.pages).toContain('pages/about/index')
  })

  it('falls back to empty collections when no service is available', async () => {
    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({}),
      }
    })

    const module = await import(modulePath)

    expect(module.routes.pages).toEqual([])
    expect(module.routes.entries).toEqual([])
    expect(module.routes.subPackages).toEqual([])
    expect(module.pages).toEqual([])
    expect(module.entries).toEqual([])
    expect(module.subPackages).toEqual([])
  })
})
