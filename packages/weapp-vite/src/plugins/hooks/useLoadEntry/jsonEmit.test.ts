import { describe, expect, it } from 'vitest'
import { createJsonEmitManager } from './jsonEmit'

describe('createJsonEmitManager', () => {
  it('normalizes json file names through relative output helper', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath.replace('/project/src/', '')
      },
    } as any)

    manager.register({
      type: 'page',
      json: { navigationBarTitleText: '首页' },
      jsonPath: '/project/src/pages/home/index.json.js',
    })

    expect(Array.from(manager.map.keys())).toEqual(['pages/home/index.json'])
    expect(manager.map.get('pages/home/index.json')).toMatchObject({
      fileName: 'pages/home/index.json',
      entry: {
        type: 'page',
        jsonPath: '/project/src/pages/home/index.json.js',
      },
    })
  })

  it('skips entries without jsonPath', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath
      },
    } as any)

    manager.register({
      type: 'component',
      json: {},
    })

    expect(manager.map.size).toBe(0)
  })

  it('supports explicit output file names for project-level sidecar json', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath.replace('/project/src/', '')
      },
    } as any)

    manager.register({
      fileName: 'app.miniapp.json',
      type: 'page',
      json: { miniVersion: 'v2' },
      jsonPath: '/project/project.miniapp.json',
    })

    expect(Array.from(manager.map.keys())).toEqual(['app.miniapp.json'])
    expect(manager.map.get('app.miniapp.json')).toMatchObject({
      fileName: 'app.miniapp.json',
      entry: {
        fileName: 'app.miniapp.json',
        jsonPath: '/project/project.miniapp.json',
        type: 'page',
      },
    })
  })

  it('normalizes emitted app json with a stable subPackages array', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath.replace('/project/src/', '')
      },
    } as any)

    manager.register({
      type: 'app',
      json: { pages: ['pages/index/index'] },
      jsonPath: '/project/src/app.json',
    })

    expect(Array.from(manager.map.values())[0]?.entry.json).toEqual({
      pages: ['pages/index/index'],
      subPackages: [],
    })
  })

  it('drops legacy subpackages after normalizing app json', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath.replace('/project/src/', '')
      },
    } as any)

    manager.register({
      type: 'app',
      json: {
        pages: ['pages/index/index'],
        subpackages: [{ root: 'pkg', pages: ['detail/index'] }],
      },
      jsonPath: '/project/src/app.json',
    })

    expect(Array.from(manager.map.values())[0]?.entry.json).toEqual({
      pages: ['pages/index/index'],
      subPackages: [{ root: 'pkg', pages: ['detail/index'] }],
    })
  })

  it('applies build scope whenever the final app json asset is registered', () => {
    const manager = createJsonEmitManager({
      platform: 'weapp',
      relativeOutputPath(filePath: string) {
        return filePath.replace('/project/src/', '')
      },
      weappViteConfig: {
        buildScope: {
          include: [],
        },
      },
    } as any)

    manager.register({
      type: 'app',
      json: {
        pages: ['pages/home/index', 'pages/profile/index'],
        preloadRule: {
          'pages/home/index': {
            packages: ['packages/excluded'],
          },
        },
        subPackages: [
          { root: 'packages/excluded', pages: ['index'] },
        ],
        tabBar: {
          color: '#000000',
          selectedColor: '#ffffff',
          backgroundColor: '#ffffff',
          list: [
            { pagePath: 'pages/home/index', text: 'home' },
            { pagePath: 'pages/profile/index', text: 'profile' },
            { pagePath: 'pages/missing/index', text: 'missing' },
          ],
        },
      },
      jsonPath: '/project/src/app.json',
    })

    expect(manager.map.get('app.json')?.entry.json).toMatchObject({
      pages: ['pages/home/index', 'pages/profile/index'],
      subPackages: [],
      tabBar: {
        list: [
          { pagePath: 'pages/home/index', text: 'home' },
          { pagePath: 'pages/profile/index', text: 'profile' },
        ],
      },
    })
    expect(manager.map.get('app.json')?.entry.json.preloadRule).toBeUndefined()
  })

  it('does not normalize app side json files as app config', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath.replace('/project/src/', '')
      },
    } as any)

    manager.register({
      type: 'app',
      json: { rules: [{ action: 'allow', page: '*' }] },
      jsonPath: '/project/src/sitemap.json',
    })

    expect(manager.map.get('sitemap.json')?.entry.json).toEqual({
      rules: [{ action: 'allow', page: '*' }],
    })
  })
})
