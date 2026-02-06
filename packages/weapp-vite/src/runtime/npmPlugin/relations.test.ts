import type { MutableCompilerContext } from '../../context'
import { describe, expect, it } from 'vitest'
import { getPackNpmRelationList } from './relations'

function createContext(options: {
  platform?: string
  multiPlatform?: boolean
  projectConfig?: Record<string, any>
}) {
  return {
    configService: {
      platform: options.platform ?? 'weapp',
      weappViteConfig: {
        multiPlatform: !!options.multiPlatform,
      },
      projectConfig: options.projectConfig ?? {},
    },
  } as MutableCompilerContext
}

describe('runtime npmPlugin relations', () => {
  it('uses default relation in non-multi-platform mode', () => {
    const ctx = createContext({
      multiPlatform: false,
      projectConfig: {
        miniprogramRoot: 'dist',
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: '.',
      },
    ])
  })

  it('uses project miniprogramRoot for alipay in multi-platform mode', () => {
    const ctx = createContext({
      platform: 'alipay',
      multiPlatform: true,
      projectConfig: {
        miniprogramRoot: 'dist',
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: 'dist/alipay/dist',
      },
    ])
  })

  it('keeps default relation for non-alipay platforms in multi-platform mode', () => {
    const ctx = createContext({
      platform: 'tt',
      multiPlatform: true,
      projectConfig: {},
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: '.',
      },
    ])
  })

  it('rewrites manual dist relation for all platforms', () => {
    const ctx = createContext({
      platform: 'xhs',
      multiPlatform: true,
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: './dist',
            },
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: '.',
            },
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: './custom',
            },
          ],
        },
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: 'dist/xhs/dist',
      },
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: '.',
      },
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: './custom',
      },
    ])
  })

  it('rewrites manual root relation for alipay only', () => {
    const ctx = createContext({
      platform: 'alipay',
      multiPlatform: true,
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: '.',
            },
          ],
        },
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: 'dist/alipay',
      },
    ])
  })
})
