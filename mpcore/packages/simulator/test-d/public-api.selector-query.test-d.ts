import type { HeadlessSelectorQueryResolverOptions } from '..'
import { expectAssignable, expectError } from 'tsd'
import { createPageInstance, executeSelectorQueryRequests } from '..'

const options: HeadlessSelectorQueryResolverOptions = {
  page: createPageInstance('/pages/index/index', {}),
  root: { type: 'root', children: [] },
  scopeId: 'page:pages/index/index/component',
  windowInfo: {
    pixelRatio: 1,
    screenWidth: 375,
    screenHeight: 667,
    windowWidth: 375,
    windowHeight: 667,
    statusBarHeight: 20,
    safeArea: { left: 0, top: 20, right: 375, bottom: 667, width: 375, height: 647 },
    safeAreaInsets: { left: 0, top: 20, right: 0, bottom: 0 },
  },
}

expectAssignable<unknown[]>(executeSelectorQueryRequests([], options))
expectError(executeSelectorQueryRequests([], { ...options, scopeId: 42 }))
