import { describe, expect, it, vi } from 'vitest'

import { hasTailwindcssDependency, resolveTouchAppWxssEnabled } from './touchAppWxss'

describe('runtime buildPlugin touchAppWxss', () => {
  it('detects tailwind dependency from dependencies and devDependencies', () => {
    expect(hasTailwindcssDependency({
      dependencies: {
        'weapp-tailwindcss': '^4.0.0',
      },
    })).toBe(true)
    expect(hasTailwindcssDependency({
      devDependencies: {
        'weapp-tailwindcss': '^4.0.0',
      },
    })).toBe(true)
    expect(hasTailwindcssDependency({})).toBe(false)
  })

  it('respects explicit touchAppWxss options before auto detection', () => {
    expect(resolveTouchAppWxssEnabled({
      option: true,
      platform: 'alipay',
      packageJson: {},
      cwd: '/project',
    })).toBe(true)

    expect(resolveTouchAppWxssEnabled({
      option: false,
      platform: 'weapp',
      packageJson: {
        dependencies: {
          'weapp-tailwindcss': '^4.0.0',
        },
      },
      cwd: '/project',
    })).toBe(false)
  })

  it('disables auto touchAppWxss for non-weapp platforms', () => {
    expect(resolveTouchAppWxssEnabled({
      option: 'auto',
      platform: 'alipay',
      packageJson: {
        dependencies: {
          'weapp-tailwindcss': '^4.0.0',
        },
      },
      cwd: '/project',
    })).toBe(false)
  })

  it('enables auto touchAppWxss when tailwind dependency exists locally', () => {
    expect(resolveTouchAppWxssEnabled({
      option: 'auto',
      platform: 'weapp',
      packageJson: {
        dependencies: {
          'weapp-tailwindcss': '^4.0.0',
        },
      },
      cwd: '/project',
    })).toBe(true)
  })

  it('falls back to node resolution when package.json does not declare tailwind', () => {
    const resolve = vi.fn(() => '/project/node_modules/weapp-tailwindcss/index.js')

    expect(resolveTouchAppWxssEnabled({
      option: 'auto',
      platform: 'weapp',
      packageJson: {},
      cwd: '/project',
      resolve,
    })).toBe(true)
    expect(resolve).toHaveBeenCalledWith('weapp-tailwindcss')
  })

  it('returns false when node resolution cannot find tailwind', () => {
    const resolve = vi.fn(() => {
      throw new Error('not found')
    })

    expect(resolveTouchAppWxssEnabled({
      option: 'auto',
      platform: 'weapp',
      packageJson: {},
      cwd: '/project',
      resolve,
    })).toBe(false)
  })
})
