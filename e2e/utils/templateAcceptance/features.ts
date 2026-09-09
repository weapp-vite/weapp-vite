import type { TemplateDomRoute } from './index'
import { renderedText, templatePage } from './index'

export const WEVU_FEATURES_TEMPLATE_DOM: TemplateDomRoute[] = [
  templatePage('/pages/index/index', [
    renderedText('.feature-nav-title', 'wevu 特性展示'),
    renderedText('.feature-nav-subtitle', '选择一个特性场景进入'),
  ]),
  templatePage('/pages/native-uses-vue/index', [
    renderedText('.native-interop-page__title', '原生组件引入 Vue 组件'),
    renderedText('#native-interop-count', 'count: 1'),
    renderedText('.native-card__subtitle', 'count: 1', ['#native-dynamic-feature', '#native-card-feature']),
  ], [
    {
      id: 'native-uses-vue:increment',
      action: 'tap count and inspect the native-to-Vue child update',
      tap: { selector: '#native-interop-count' },
      nodes: [renderedText('#native-interop-count', 'count: 2'), renderedText('.native-card__subtitle', 'count: 2', ['#native-dynamic-feature', '#native-card-feature'])],
    },
  ]),
  templatePage('/pages/router-coverage/index', [
    renderedText('.router-coverage-page__title', 'wevu/router 页面跳转覆盖'),
    renderedText('#router-coverage-action', 'last action = idle'),
    { selector: '.router-coverage-page__card', count: 3 },
  ]),
  templatePage('/pages/router-coverage/main-target/index', [
    renderedText('.router-target-page__badge', '主包目标页'),
    renderedText('#router-target-main-route', 'route = /pages/router-coverage/main-target/index'),
  ]),
  templatePage('/pages/router-dynamic/index', [
    renderedText('.router-dynamic-page__title', 'wevu/router 能力展示 (dynamic + guards)'),
    renderedText('#router-dynamic-run', 'run summary = idle'),
    renderedText('#router-dynamic-run-e2e', 'run router dynamic e2e'),
  ]),
  templatePage('/pages/router-showcase/index', [
    renderedText('.router-showcase-page__title', 'wevu/router 能力展示 (showcase)'),
    renderedText('#router-showcase-run', 'run summary = idle'),
    renderedText('#router-showcase-run-e2e', 'run router showcase e2e'),
  ]),
  templatePage('/pages/router-stability/index', [
    renderedText('.router-stability-page__title', 'router stability (page context)'),
    renderedText('#router-open-sub', '打开 sub 页面'),
  ]),
  templatePage('/pages/router-stability/sub/index', [
    renderedText('.router-sub-page__title', 'router stability (sub page)'),
    renderedText('#router-sub-call-component-router', '组件 this.router.navigateTo(\'./target/index\')'),
  ]),
  templatePage('/pages/router-stability/sub/target/index', [
    renderedText('#router-target-sub-marker', 'route=pages/router-stability/sub/target/index source=unknown'),
  ]),
  templatePage('/pages/router-stability/target/index', [
    renderedText('#router-target-main-marker', 'route=pages/router-stability/target/index source=unknown'),
  ]),
  templatePage('/pages/sfc-styles/index', [
    renderedText('#sfc-style-label', 'CSS vars + modules'),
    { selector: '#sfc-style-probe', visible: true, styles: { 'background-color': 'rgb(220, 38, 38)' } },
  ], [
    {
      id: 'sfc-styles:updated',
      provider: 'devtools',
      action: 'run the CSS variable update and inspect the computed background',
      method: 'runE2E',
      nodes: [renderedText('#sfc-style-label', 'CSS vars + modules'), { selector: '#sfc-style-probe', visible: true, styles: { 'background-color': 'rgb(37, 99, 235)' } }],
    },
  ]),
  templatePage('/pages/subpath-entries/index', [
    renderedText('.subpath-entries-page__title', 'wevu 子路径入口综合场景'),
    renderedText('#subpath-run-summary', 'run summary = idle'),
    renderedText('#subpath-request-count', 'request count = 0'),
  ]),
  templatePage('/pages/use-attrs/index', [
    renderedText('.use-attrs-page__title', 'wevu useAttrs 特性展示'),
    renderedText('#ctrl-cycle-tone', '切换 tone：tone-blue'),
    renderedText('#ctrl-bump-seed', '递增 seed：1'),
  ], [
    {
      id: 'use-attrs:seed',
      action: 'tap seed and inspect the rendered control value',
      tap: { selector: '#ctrl-bump-seed' },
      nodes: [renderedText('#ctrl-bump-seed', '递增 seed：2')],
    },
  ]),
  templatePage('/pages/use-model/index', [
    renderedText('#model-parent-value', 'parent modelValue = seed-model'),
    renderedText('#model-log-size', 'emit logs = 0'),
  ], [
    {
      id: 'use-model:alpha',
      action: 'tap parent alpha and inspect the model and event log count',
      tap: { selector: '#model-parent-alpha' },
      nodes: [renderedText('#model-parent-value', 'parent modelValue = alpha-from-parent'), renderedText('#model-log-size', 'emit logs = 1')],
    },
  ]),
  templatePage('/pages/use-provide-inject/index', [
    renderedText('#provide-state', 'provider theme = teal'),
    renderedText('#provide-count', 'provider count = 1'),
  ], [
    {
      id: 'use-provide-inject:increment',
      action: 'tap provider increment and inspect the rendered count',
      tap: { selector: '#provide-inc' },
      nodes: [renderedText('#provide-count', 'provider count = 2')],
    },
  ]),
  templatePage('/pages/use-provide-inject-scope/index', [
    renderedText('.provide-inject-scope-page__title', 'wevu provide / inject 深层作用域复现'),
    renderedText('#scope-page-provider', 'page provide = page-provide-value'),
    renderedText('#scope-layout-provider', 'layout provide = layout-provide-value', [{ has: '#scope-layout-provider' }]),
  ]),
  templatePage('/pages/use-slots/index', [
    renderedText('#slots-open-state', 'open state: open'),
    renderedText('#slots-ctrl-count', 'count: 1'),
  ], [
    {
      id: 'use-slots:close',
      action: 'tap close and inspect the rendered closed state',
      tap: { selector: '#slots-ctrl-open' },
      nodes: [renderedText('#slots-open-state', 'open state: closed')],
    },
  ]),
  templatePage('/pages/use-store/index', [
    renderedText('.use-store-page__title', 'wevu store 特性展示'),
    renderedText('#store-setup-ref-write', 'setup refs write'),
    renderedText('#store-options-ref-write', 'options refs write'),
  ], [
    {
      id: 'use-store:ref-write',
      action: 'write setup refs and inspect count and computed doubled',
      tap: { selector: '#store-setup-ref-write' },
      nodes: [renderedText('#store-setup-count', 'setup count = 4'), renderedText('#store-setup-doubled', 'setup doubled = 8')],
    },
  ]),
  templatePage('/components/router-origin-probe/target/index', [
    renderedText('#router-target-component-marker', 'route=components/router-origin-probe/target/index source=unknown'),
  ]),
  templatePage('/packages/router-demo/pages/normal-target/index', [
    renderedText('.router-subpackage-page__badge', '普通分包目标页'),
    renderedText('#router-target-subpackage-route', 'route = /packages/router-demo/pages/normal-target/index'),
  ]),
  templatePage('/packages/router-demo-independent/pages/independent-target/index', [
    renderedText('.router-independent-page__badge', '独立分包目标页'),
    renderedText('#router-target-independent-route', 'route = /packages/router-demo-independent/pages/independent-target/index'),
  ]),
]
