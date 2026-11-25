import type { ModuleResolver } from '@wevu/compiler'
import { injectWevuPageFeaturesInJsWithResolver } from '@wevu/compiler'
import { expectAssignable, expectError } from 'tsd'

const resolver: ModuleResolver = {
  async resolveId() {
    return undefined
  },
  async loadCode() {
    return undefined
  },
}

const result = injectWevuPageFeaturesInJsWithResolver('', {
  id: 'src/pages/index.ts',
  resolver,
  pageFeatureFlags: ['enableOnShareTimeline'],
})

expectAssignable<Promise<unknown>>(result)
expectError(injectWevuPageFeaturesInJsWithResolver('', {
  id: 'src/pages/index.ts',
  resolver,
  pageFeatureFlags: ['invalid'],
}))
