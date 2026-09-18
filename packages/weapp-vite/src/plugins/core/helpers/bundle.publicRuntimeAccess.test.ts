import type { OutputBundle } from 'rolldown'
import { expect, it } from 'vitest'
import { stabilizeWevuRuntimeChunkAccess } from './bundle'

it('keeps public runtime calls identical when an incremental bundle omits unchanged vendor chunks', () => {
  const code = [
    'const runtime = require("../../weapp-vendors/wevu-runtime.js");',
    'runtime.defineComponent({});',
    'runtime.createWevuComponent({});',
    'runtime.onShareAppMessage(() => ({}));',
    'runtime.onShareTimeline(() => ({}));',
    'runtime.onAddToFavorites(() => ({}));',
    'runtime.onSaveExitState(() => ({}));',
    'require("../../weapp-vendors/wevu-runtime.js").defineComponent({});',
    'require("../../weapp-vendors/wevu-runtime.js").createWevuComponent({});',
  ].join('\n')
  const createPage = () => ({ type: 'chunk', fileName: 'pages/index/index.js', code, imports: ['weapp-vendors/wevu-runtime.js'] })
  const fullBundle = {
    'pages/index/index.js': createPage(),
    'weapp-vendors/wevu-reactivity.js': {
      type: 'chunk',
      fileName: 'weapp-vendors/wevu-reactivity.js',
      code: ['assertInSetup', 'pushHook'].map(name => `Object.defineProperty(exports, "${name}", { enumerable: true, get: function() { return ${name}; } });`).join('\n'),
      imports: [],
    },
    'weapp-vendors/wevu-runtime.js': {
      type: 'chunk',
      fileName: 'weapp-vendors/wevu-runtime.js',
      code: [
        'const base = require("./wevu-reactivity.js");',
        ...['onShareAppMessage', 'onShareTimeline', 'onAddToFavorites', 'onSaveExitState'].map(name => `Object.defineProperty(exports, "${name}", { enumerable: true, get: function() { return ${name}; } });`),
        'function defineComponent(options) { return options; }',
        'function createWevuComponent(options) { return defineComponent(options); }',
        'Object.defineProperty(exports, "defineComponent", { enumerable: true, get: function() { return defineComponent; } });',
        'Object.defineProperty(exports, "createWevuComponent", { enumerable: true, get: function() { return createWevuComponent; } });',
      ].join('\n'),
      imports: [],
    },
  } as unknown as OutputBundle
  const incrementalBundle = { 'pages/index/index.js': createPage() } as unknown as OutputBundle
  stabilizeWevuRuntimeChunkAccess(fullBundle)
  stabilizeWevuRuntimeChunkAccess(incrementalBundle)
  expect(fullBundle['pages/index/index.js']).toMatchObject({ code })
  expect(incrementalBundle['pages/index/index.js']).toMatchObject({ code })
})
