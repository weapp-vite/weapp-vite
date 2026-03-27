import type { MutableCompilerContext } from '../../context'
import { describe, expect, it } from 'vitest'
import { getPackNpmRelationList } from './relations'

function createContext(options: {
  pluginOnly?: boolean
  absolutePluginOutputRoot?: string
  platform?: string
  multiPlatform?: boolean | { enabled?: boolean }
  projectConfig?: Record<string, any>
}) {
  return {
    configService: {
      absolutePluginOutputRoot: options.absolutePluginOutputRoot,
      outDir: '/project/dist',
      pluginOnly: options.pluginOnly ?? false,
      platform: options.platform ?? 'weapp',
      weappViteConfig: {
        multiPlatform: options.multiPlatform ?? false,
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

  it('uses project miniprogramRoot for alipay in non-multi-platform mode', () => {
    const ctx = createContext({
      platform: 'alipay',
      multiPlatform: false,
      projectConfig: {
        miniprogramRoot: 'dist',
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: 'dist',
      },
    ])
  })

  it('normalizes dot project root for alipay in non-multi-platform mode', () => {
    const ctx = createContext({
      platform: 'alipay',
      multiPlatform: false,
      projectConfig: {
        miniprogramRoot: './',
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

  it('falls back to dist project root for alipay when project root is missing', () => {
    const ctx = createContext({
      platform: 'alipay',
      multiPlatform: true,
      projectConfig: {},
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

  it('treats object multiPlatform config with enabled false as disabled', () => {
    const ctx = createContext({
      platform: 'alipay',
      multiPlatform: {
        enabled: false,
      },
      projectConfig: {
        miniprogramRoot: 'dist',
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: 'dist',
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

  it('normalizes leading dot and trailing slashes in manual dist relations', () => {
    const ctx = createContext({
      platform: 'jd',
      multiPlatform: true,
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: './dist///',
            },
          ],
        },
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: 'dist/jd/dist',
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

  it('routes pluginOnly npm output to the plugin output root', () => {
    const ctx = createContext({
      pluginOnly: true,
      absolutePluginOutputRoot: '/project/dist-plugin',
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: './dist',
            },
          ],
        },
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: '/project/dist-plugin',
      },
    ])
  })

  it('falls back to outDir for pluginOnly mode when plugin output root is missing', () => {
    const ctx = createContext({
      pluginOnly: true,
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: './dist',
            },
          ],
        },
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: '/project/dist',
      },
    ])
  })

  it('returns empty list for pluginOnly mode when no main relation exists', () => {
    const ctx = createContext({
      pluginOnly: true,
      absolutePluginOutputRoot: '/project/dist-plugin',
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [],
        },
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([])
  })

  it('preserves absolute manual relation paths in multi-platform mode', () => {
    const ctx = createContext({
      platform: 'tt',
      multiPlatform: true,
      projectConfig: {
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            {
              packageJsonPath: './package.json',
              miniprogramNpmDistDir: '/already/absolute',
            },
          ],
        },
      },
    })

    expect(getPackNpmRelationList(ctx)).toEqual([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: '/already/absolute',
      },
    ])
  })
})
