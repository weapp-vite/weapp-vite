import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { getAutoRoutesSubPackageRoots } from './subPackageRoots'

describe('getAutoRoutesSubPackageRoots', () => {
  it('preserves excluded subpackage roots for route classification', () => {
    const runtimeState = createRuntimeState()
    const roots = getAutoRoutesSubPackageRoots({
      configService: {
        weappViteConfig: {
          buildScope: {
            include: ['pages'],
          },
          subPackages: {
            subs: {},
          },
        },
      } as any,
      runtimeState,
    })

    expect(roots).toEqual(['subs'])
  })
})
