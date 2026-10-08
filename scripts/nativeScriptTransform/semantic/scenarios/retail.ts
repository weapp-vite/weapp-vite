import type { SemanticCoverage, SemanticScenario, SemanticTools } from '../types'
import { retailBindingPaths, retailFixture, retailFunctionPaths } from './fixtures'
import { createScenarioHost } from './host'
import { observeRetailProjections, retailProjectionAssertions } from './projections'
import { observeRetailHandlers, retailHandlerAssertions } from './retailHandlers'
import { observeRetailLifecycle, retailLifecycleAssertions } from './retailLifecycle'
import { createRetailServices } from './retailServices'

const inlineIds = ['i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'ia', 'ib', 'ic', 'id']
const lifecycleNames = ['onShareAppMessage', 'onLoad']
const computedKeys = ['__wv_cls_0', '__wv_bind_0']
const requiredAssertions = [
  'registration-count',
  'registration-order',
  'page-flag',
  'manifest-frozen',
  'data-factory-independent',
  'setup-expose',
  'lifecycle-registration',
  'inline-inventory',
  'computed-inventory',
  'setup-order',
  'manifest-content',
  'function-prop-paths',
  'page-features',
  'initial-computed',
  ...retailLifecycleAssertions,
  ...retailHandlerAssertions,
  ...retailProjectionAssertions,
  'all-inline-executed',
]
export const retailCoverage: SemanticCoverage = { inlineIds, computedKeys, lifecycleNames, requiredAssertions }

export function createRetailScenario(tools: SemanticTools): SemanticScenario {
  const host = createScenarioHost(tools, lifecycleNames)
  const services = createRetailServices(host, tools)
  const fixture = retailFixture()
  return {
    id: 'sfc-retail',
    coverage: retailCoverage,
    imports: { ...host.imports, ...services.imports },
    globals: host.globals,
    async observe(namespace) {
      const { options, ctx, initialData } = host.initialize(namespace, inlineIds, computedKeys)
      host.check('setup-order', host.trace.map(item => item.label), ['install-inline-events', 'register-component', 'setup-expose', 'native-instance', 'register-hook', 'register-hook'])
      host.check('manifest-content', options.__wevuBindingManifest, { version: 1, sourceFile: 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue', bindings: retailBindingPaths.map((outputPath, index) => ({ id: `b${index}`, outputPath })) })
      host.check('function-prop-paths', options.__wevuFunctionPropPaths, retailFunctionPaths)
      host.check('page-features', options.features, { enableOnShareAppMessage: true })
      host.check('initial-computed', { images: ctx.detailImages, visible: ctx.visibleActivityList, class: options.computed.__wv_cls_0!.call(ctx), comments: options.computed.__wv_bind_0!.call(ctx) }, { images: [], visible: [], class: 'tintColor', comments: undefined })
      await observeRetailLifecycle(host, tools, services, ctx, fixture)
      await observeRetailHandlers(host, services, options, ctx, fixture)
      observeRetailProjections(host, options)
      services.queue.assertEmpty()
      await tools.flush()
      return {
        ...host.finish(inlineIds, requiredAssertions),
        initialData,
        services: services.queue.calls,
        toasts: services.toasts,
        final: tools.snapshot(host.pick(ctx, ['spuId', 'buyNum', 'buyType', 'selectedAttrStr', 'isAllSelectedSku', 'selectedSkuItem', 'isSpuSelectPopupShow', 'isShowPromotionPop', 'commentsStatistics', 'commentsList', 'detailImages', 'detailTitle', 'visibleActivityList'])),
      }
    },
    dispose() {
      host.dispose()
      services.queue.assertEmpty()
    },
  }
}
