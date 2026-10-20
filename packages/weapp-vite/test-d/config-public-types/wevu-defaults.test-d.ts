import { expectError } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

defineConfig({
  weapp: {
    wevu: {
      defaults: {
        app: { data: { title: 'demo' }, setData: { strategy: 'patch' } },
        component: {
          allowNullPropInput: true,
          setupLifecycle: 'attached',
          features: { enableOnPageScroll: true },
          options: { virtualHost: true, styleIsolation: 'isolated' },
          setData: { strategy: 'patch', debugPhases: true, pick: ['count'] },
          custom: { enabled: true, values: [1, 'value', null] },
        },
      },
    },
  },
})
expectError(defineConfig({ weapp: { wevu: { defaults: { component: { setup: () => ({}) } } } } }))
expectError(defineConfig({ weapp: { wevu: { defaults: { component: { setData: { debug: () => {} } } } } } }))
expectError(defineConfig({ weapp: { wevu: { defaults: { component: { options: { pureDataPattern: /^_/ } } } } } }))
expectError(defineConfig({ weapp: { wevu: { defaults: { component: { setData: { strategy: 'invalid' } } } } } }))
expectError(defineConfig({ weapp: { wevu: { defaults: { component: { custom: Symbol('value') } } } } }))
expectError(defineConfig({ weapp: { wevu: { defaults: { component: { custom: new Date() } } } } }))
expectError(defineConfig({ weapp: { wevu: { defaults: { component: { custom: 1n } } } } }))
