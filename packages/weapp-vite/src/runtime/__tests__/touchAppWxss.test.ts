import type { PackageJson } from 'pkg-types'
import { describe, expect, it, vi } from 'vitest'
import { resolveTouchAppWxssEnabled } from '../buildPlugin/touchAppWxss'

describe('resolveTouchAppWxssEnabled', () => {
  const base = {
    option: 'auto' as const,
    platform: 'weapp' as const,
    cwd: '/project',
    packageJson: {} as PackageJson,
  }

  it('honors explicit true', () => {
    const enabled = resolveTouchAppWxssEnabled({
      ...base,
      option: true,
      platform: 'alipay',
    })
    expect(enabled).toBe(true)
  })

  it('honors explicit false', () => {
    const enabled = resolveTouchAppWxssEnabled({
      ...base,
      option: false,
    })
    expect(enabled).toBe(false)
  })

  it('disables auto on non-weapp platform', () => {
    const enabled = resolveTouchAppWxssEnabled({
      ...base,
      platform: 'alipay',
    })
    expect(enabled).toBe(false)
  })

  it('enables auto when dependency is present', () => {
    const resolve = vi.fn(() => '/project/node_modules/weapp-tailwindcss/package.json')
    const enabled = resolveTouchAppWxssEnabled({
      ...base,
      packageJson: {
        dependencies: {
          'weapp-tailwindcss': '^4.0.0',
        },
      },
      resolve,
    })
    expect(enabled).toBe(true)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('enables auto when resolver finds package', () => {
    const resolve = vi.fn(() => '/project/node_modules/weapp-tailwindcss/package.json')
    const enabled = resolveTouchAppWxssEnabled({
      ...base,
      resolve,
    })
    expect(enabled).toBe(true)
    expect(resolve).toHaveBeenCalledWith('weapp-tailwindcss')
  })

  it('disables auto when resolver fails', () => {
    const resolve = vi.fn(() => {
      throw new Error('not found')
    })
    const enabled = resolveTouchAppWxssEnabled({
      ...base,
      resolve,
    })
    expect(enabled).toBe(false)
  })
})
