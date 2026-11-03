import type { WeappViteConfig } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable } from 'tsd'

expectAssignable<WeappViteConfig>({
  web: {
    pluginOptions: {
      templateInput: { platform: 'weapp', syntax: 'xml', rawTags: ['wxs', 'script'] },
    },
  },
})
expectNotAssignable<WeappViteConfig>({
  web: { pluginOptions: { templateInput: { syntax: 'html' } } },
})
