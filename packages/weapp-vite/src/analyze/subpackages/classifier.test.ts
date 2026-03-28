import { describe, expect, it } from 'vitest'
import { SHARED_CHUNK_VIRTUAL_PREFIX } from '../../runtime/chunkStrategy'
import {
  classifyModuleSourceKind,
  classifyPackage,
  normalizeModuleId,
  resolveAssetSource,
  resolveModuleSourceType,
  resolvePluginAssetAbsolute,
} from './classifier'

describe('analyze subpackages classifier', () => {
  it('classifies virtual/subpackage/main package outputs', () => {
    const context = {
      subPackageRoots: new Set(['subA', 'subB']),
      independentRoots: new Set(['subA']),
    }

    expect(
      classifyPackage(
        `${SHARED_CHUNK_VIRTUAL_PREFIX}/subA+subB/chunk.js`,
        'main',
        context,
      ),
    ).toEqual({
      id: 'virtual:subA+subB',
      label: '共享虚拟包 subA+subB',
      type: 'virtual',
    })

    expect(classifyPackage('subA/page.js', 'main', context)).toEqual({
      id: 'subA',
      label: '独立分包 subA',
      type: 'independent',
    })

    expect(classifyPackage('subB/page.js', 'independent', context)).toEqual({
      id: 'subB',
      label: '分包 subB',
      type: 'independent',
    })

    expect(classifyPackage('main/index.js', 'main', context)).toEqual({
      id: '__main__',
      label: '主包',
      type: 'main',
    })
  })

  it('normalizes module id only for absolute non-virtual ids', () => {
    expect(normalizeModuleId('')).toBeUndefined()
    expect(normalizeModuleId('src/index.ts')).toBeUndefined()
    expect(normalizeModuleId('/project/src/\u0000virtual.ts')).toBeUndefined()
    expect(normalizeModuleId('/project/src/../src/index.ts')).toBe('/project/src/index.ts')
  })

  it('resolves module source type with src/plugin/workspace/node_modules cases', () => {
    const ctx = {
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: '/project/plugin-root',
        relativeAbsoluteSrcRoot: (absolute: string) => absolute.replace('/project/', ''),
      },
    } as any

    expect(resolveModuleSourceType('/project/node_modules/pkg/index.js', ctx)).toEqual({
      source: 'node_modules/pkg/index.js',
      sourceType: 'node_modules',
    })
    expect(resolveModuleSourceType('/project/src/pages/home.ts', ctx)).toEqual({
      source: 'src/pages/home.ts',
      sourceType: 'src',
    })
    expect(resolveModuleSourceType('/project/plugin-root/components/a.ts', ctx)).toEqual({
      source: 'plugin-root/components/a.ts',
      sourceType: 'plugin',
    })
    expect(resolveModuleSourceType('/workspace/shared/index.ts', ctx)).toEqual({
      source: '/workspace/shared/index.ts',
      sourceType: 'workspace',
    })
  })

  it('classifies module source kind by priority', () => {
    expect(classifyModuleSourceKind({
      isNodeModule: true,
      inSrc: true,
      inPlugin: true,
    })).toBe('node_modules')

    expect(classifyModuleSourceKind({
      isNodeModule: false,
      inSrc: true,
      inPlugin: true,
    })).toBe('src')

    expect(classifyModuleSourceKind({
      isNodeModule: false,
      inSrc: false,
      inPlugin: true,
    })).toBe('plugin')

    expect(classifyModuleSourceKind({
      isNodeModule: false,
      inSrc: false,
      inPlugin: false,
    })).toBe('workspace')
  })

  it('resolves plugin asset absolute path only for plugin-root descendants', () => {
    expect(resolvePluginAssetAbsolute('plugin-root/components/a.wxml', '/project/plugin-root')).toBe('/project/plugin-root/components/a.wxml')
    expect(resolvePluginAssetAbsolute('plugin-root', '/project/plugin-root')).toBe('/project/plugin-root')
    expect(resolvePluginAssetAbsolute('other-root/components/a.wxml', '/project/plugin-root')).toBeUndefined()
    expect(resolvePluginAssetAbsolute('../escape.wxml', '/project/plugin-root')).toBeUndefined()
    expect(resolvePluginAssetAbsolute('plugin-root/components/a.wxml')).toBeUndefined()
  })

  it('resolves asset source from src/plugin roots and ignores unknown paths', () => {
    const ctx = {
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: '/project/plugin-root',
        relativeAbsoluteSrcRoot: (absolute: string) => absolute.replace('/project/', ''),
      },
    } as any

    expect(resolveAssetSource('pages/home/index.wxml', ctx)).toEqual({
      absolute: '/project/src/pages/home/index.wxml',
      source: 'src/pages/home/index.wxml',
      sourceType: 'src',
    })

    expect(resolveAssetSource('plugin-root/components/a.wxml', ctx)).toEqual({
      absolute: '/project/src/plugin-root/components/a.wxml',
      source: 'src/plugin-root/components/a.wxml',
      sourceType: 'src',
    })

    expect(resolveAssetSource('plugin-root', ctx)).toEqual({
      absolute: '/project/src/plugin-root',
      source: 'src/plugin-root',
      sourceType: 'src',
    })

    expect(resolveAssetSource('../outside/file.wxml', ctx)).toBeUndefined()
  })
})
