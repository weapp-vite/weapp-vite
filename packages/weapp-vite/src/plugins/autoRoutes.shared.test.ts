import { describe, expect, it } from 'vitest'
import {
  AUTO_ROUTES_ID,
  collectAutoRoutesWatchDirs,
  createAutoRoutesSidecarWatcher,
  isAutoRoutesWatchFile,
  isAutoRoutesWatchMode,
  resolveAutoRoutesHotUpdateAction,
  resolveAutoRoutesVirtualId,
  resolveAutoRoutesWatchChangeEvent,
  RESOLVED_VIRTUAL_ID,
  shouldStartAutoRoutesWatcher,
  VIRTUAL_MODULE_ID,
} from './autoRoutes.shared'

describe('auto routes plugin shared helpers', () => {
  it('detects dev and build watch modes', () => {
    expect(isAutoRoutesWatchMode()).toBe(false)
    expect(isAutoRoutesWatchMode({
      isDev: true,
      inlineConfig: {},
    } as any)).toBe(true)
    expect(isAutoRoutesWatchMode({
      isDev: false,
      inlineConfig: {
        build: {
          watch: {},
        },
      },
    } as any)).toBe(true)
  })

  it('collects and de-duplicates auto routes watch directories', () => {
    expect(collectAutoRoutesWatchDirs(
      ['/project/src/pages', '/project/src/views'],
      ['/project/src/views', '/project/src/pkgA/screens'],
    )).toEqual([
      '/project/src/pages',
      '/project/src/views',
      '/project/src/pkgA/screens',
    ])
  })

  it('filters route vue files by extension and pages matcher', () => {
    const isPagesRelatedPath = (id: string) => id.includes('/pages/') || id.includes('\\pages\\')
    const allowedExtensions = new Set(['.vue', '.ts'])

    expect(isAutoRoutesWatchFile('/project/src/pages/home/index.vue', allowedExtensions, isPagesRelatedPath)).toBe(true)
    expect(isAutoRoutesWatchFile('C:\\project\\src\\pages\\home\\index.ts', allowedExtensions, isPagesRelatedPath)).toBe(true)
    expect(isAutoRoutesWatchFile('/project/src/pages/home/index.scss', allowedExtensions, isPagesRelatedPath)).toBe(false)
    expect(isAutoRoutesWatchFile('/project/src/components/card/index.vue', allowedExtensions, isPagesRelatedPath)).toBe(false)
  })

  it('checks watcher startup preconditions', () => {
    expect(shouldStartAutoRoutesWatcher({
      routeWatcherStarted: true,
      isDev: true,
      autoRoutesEnabled: true,
      autoRoutesWatch: true,
      serviceEnabled: true,
      watchDirsLength: 1,
    })).toBe(false)

    expect(shouldStartAutoRoutesWatcher({
      routeWatcherStarted: false,
      isDev: false,
      autoRoutesEnabled: true,
      autoRoutesWatch: true,
      serviceEnabled: true,
      watchDirsLength: 1,
    })).toBe(false)

    expect(shouldStartAutoRoutesWatcher({
      routeWatcherStarted: false,
      isDev: true,
      autoRoutesEnabled: true,
      autoRoutesWatch: true,
      serviceEnabled: true,
      watchDirsLength: 0,
    })).toBe(false)

    expect(shouldStartAutoRoutesWatcher({
      routeWatcherStarted: false,
      isDev: true,
      autoRoutesEnabled: true,
      autoRoutesWatch: true,
      serviceEnabled: true,
      watchDirsLength: 2,
    })).toBe(true)
  })

  it('wraps sidecar watcher close handle', () => {
    let closed = false
    const sidecarWatcher = createAutoRoutesSidecarWatcher({
      close: () => {
        closed = true
      },
    })

    sidecarWatcher.close()
    expect(closed).toBe(true)
  })

  it('resolves virtual auto-routes ids and alias fallbacks', () => {
    const aliasTargets = new Set(['/project/src/auto-routes.ts'])

    expect(resolveAutoRoutesVirtualId(AUTO_ROUTES_ID, aliasTargets)).toBe(RESOLVED_VIRTUAL_ID)
    expect(resolveAutoRoutesVirtualId(VIRTUAL_MODULE_ID, aliasTargets)).toBe(RESOLVED_VIRTUAL_ID)
    expect(resolveAutoRoutesVirtualId(RESOLVED_VIRTUAL_ID, aliasTargets)).toBe(RESOLVED_VIRTUAL_ID)
    expect(resolveAutoRoutesVirtualId('/project/src/auto-routes.ts', aliasTargets)).toBe(RESOLVED_VIRTUAL_ID)
    expect(resolveAutoRoutesVirtualId('/project/src/pages/index.ts', aliasTargets)).toBeNull()
  })

  it('maps watch change events to rename-like structural changes only', () => {
    expect(resolveAutoRoutesWatchChangeEvent('create')).toBe('rename')
    expect(resolveAutoRoutesWatchChangeEvent('delete')).toBe('rename')
    expect(resolveAutoRoutesWatchChangeEvent('update')).toBeUndefined()
    expect(resolveAutoRoutesWatchChangeEvent()).toBeUndefined()
  })

  it('decides hot update handling for serve and build flows', () => {
    expect(resolveAutoRoutesHotUpdateAction('serve', {
      isRouteFile: true,
      isPagesRelatedPath: false,
    })).toEqual({
      shouldHandle: true,
      shouldUpdateRouteFile: true,
    })

    expect(resolveAutoRoutesHotUpdateAction('serve', {
      isRouteFile: false,
      isPagesRelatedPath: true,
    })).toEqual({
      shouldHandle: false,
      shouldUpdateRouteFile: false,
    })

    expect(resolveAutoRoutesHotUpdateAction('build', {
      isRouteFile: false,
      isPagesRelatedPath: true,
    })).toEqual({
      shouldHandle: true,
      shouldUpdateRouteFile: false,
    })

    expect(resolveAutoRoutesHotUpdateAction(undefined, {
      isRouteFile: false,
      isPagesRelatedPath: false,
    })).toEqual({
      shouldHandle: false,
      shouldUpdateRouteFile: false,
    })
  })
})
