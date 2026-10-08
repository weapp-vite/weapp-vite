import type { SemanticCoverage, SemanticScenario, SemanticTools } from '../types'
import assert from 'node:assert/strict'
import { wevuFixture } from './fixtures'
import { createScenarioHost, strictObject } from './host'
import { observeWevuProjections, wevuProjectionAssertions } from './projections'

const inlineIds = ['i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6']
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
  'initial-categories',
  'initial-filter-classes',
  'select-resolved-scope',
  'fixed-navigation',
  'category-navigation',
  'expand-category',
  'collapse-category',
  'query-recomputation',
  'doc-url-query',
  'scope-resolver-fallback',
  'empty-navigation',
  'manifest-content',
  'api-sort',
  ...wevuProjectionAssertions,
  'all-inline-executed',
]
export const wevuCoverage: SemanticCoverage = { inlineIds, computedKeys: ['__wv_cls_0'], lifecycleNames: [], requiredAssertions }

export function createWevuScenario(tools: SemanticTools): SemanticScenario {
  const host = createScenarioHost(tools, [])
  const fixture = wevuFixture()
  const navigation: string[] = []
  const wx = strictObject('wx', {
    navigateTo(payload: { url: string }) {
      assert.equal(typeof payload.url, 'string')
      assert(payload.url.startsWith('/pages/'))
      navigation.push(payload.url)
      host.record('wx.navigateTo', payload)
    },
  })
  return {
    id: 'sfc-wevu',
    coverage: wevuCoverage,
    imports: {
      ...host.imports,
      '../../data/miniprogram-api.json': { default: { apis: fixture.apis } },
      '../../data/miniprogram-categories': { getCategoryMeta(key: string) {
        assert(Object.hasOwn(fixture.categories, key), `Unknown category ${key}`)
        return { ...fixture.categories[key as keyof typeof fixture.categories] }
      } },
    },
    globals: { ...host.globals, wx },
    async observe(namespace) {
      const { options, ctx, initialData } = host.initialize(namespace, inlineIds, ['__wv_cls_0'])
      const paths = ['query', 'filterList', '__wv_cls_0', 'filterList', 'filterList', ...Array.from({ length: 11 }).fill('categoryList')]
      host.check('manifest-content', options.__wevuBindingManifest, { version: 1, sourceFile: 'apps/wevu-vue-demo/src/pages/index/index.vue', bindings: paths.map((outputPath, index) => ({ id: `b${index}`, outputPath })) })
      const categories = () => ctx.categoryList.map((item: { key: string, total: number, apis: unknown[], hiddenCount: number, expanded: boolean }) => ({ key: item.key, total: item.total, shown: item.apis.length, hidden: item.hiddenCount, expanded: item.expanded }))
      host.check('initial-categories', categories(), [{ key: 'base', total: 20, shown: 18, hidden: 2, expanded: false }, { key: 'device', total: 2, shown: 2, hidden: 0, expanded: false }])
      host.check('api-sort', [ctx.categoryList[0].apis[0].fullName, ctx.categoryList[0].apis.at(-1).fullName], ['wx.base00', 'wx.base17'])
      host.check('initial-filter-classes', options.computed.__wv_cls_0!.call(ctx), ['filter active', 'filter', 'filter'])
      ctx.filter = { key: 'wrong-context' }
      host.dispatch(options, ctx, 'i0', {}, { wvS0: { key: 'wrong-dataset' }, wvI0: 2 })
      host.check('select-resolved-scope', { active: ctx.activeCategory, categories: categories(), classes: options.computed.__wv_cls_0!.call(ctx) }, { active: 'device', categories: [{ key: 'device', total: 2, shown: 2, hidden: 0, expanded: false }], classes: ['filter', 'filter', 'filter active'] })
      for (const id of ['i1', 'i2', 'i3', 'i4']) {
        host.dispatch(options, ctx, id, {})
      }
      host.check('fixed-navigation', navigation, ['/pages/wevu/index', '/pages/vue-compat/index', '/pages/config-ts/index', '/pages/config-js/index'])
      ctx.category = { key: 'wrong-context', demoPath: '/wrong-context' }
      host.dispatch(options, ctx, 'i5', {}, { wvS0: { demoPath: '/wrong-dataset' }, wvI0: 0 })
      host.check('category-navigation', navigation.at(-1), '/pages/api-demos/device/index')
      ctx.selectCategory('all')
      host.dispatch(options, ctx, 'i6', {}, { wvS0: { key: 'wrong-dataset' }, wvI0: 0 })
      host.check('expand-category', categories()[0], { key: 'base', total: 20, shown: 20, hidden: 0, expanded: true })
      host.dispatch(options, ctx, 'i6', {}, { wvI0: 0 })
      host.check('collapse-category', categories()[0], { key: 'base', total: 20, shown: 18, hidden: 2, expanded: false })
      ctx.query = ' WIFI '
      host.check('query-recomputation', { categories: categories(), names: ctx.categoryList[0].apis.map((item: { fullName: string }) => item.fullName) }, { categories: [{ key: 'device', total: 1, shown: 1, hidden: 0, expanded: false }], names: ['wx.deviceWifi'] })
      ctx.query = 'docs/battery'
      host.check('doc-url-query', ctx.categoryList[0].apis.map((item: { fullName: string }) => item.fullName), ['wx.deviceBattery'])
      const navigationCount = navigation.length
      ctx.jump('')
      host.check('empty-navigation', navigation.length, navigationCount)
      const fallbackCtx = { selectCategory: ctx.selectCategory, get filterList() {
        throw new Error('controlled resolver failure')
      } }
      host.dispatch(options, fallbackCtx, 'i0', {}, { wvS0: { key: 'base' }, wvI0: 0 })
      host.check('scope-resolver-fallback', ctx.activeCategory, 'base')
      observeWevuProjections(host, options)
      await tools.flush()
      return { ...host.finish(inlineIds, requiredAssertions), initialData, final: tools.snapshot(host.pick(ctx, ['query', 'activeCategory', 'expandedMap', 'filterList', 'categoryList'])), navigation }
    },
    dispose() { host.dispose() },
  }
}
