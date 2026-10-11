import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createStatefulHmrControlSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/runtimeSource'
import { compileVueHmrSequence } from './compiledVueComponentHmr'

/** 真实 Wevu 页面依次编辑模板、还原模板和修改脚本，共用实际 HMR 客户端与 Store。 */
export async function createStatefulStoreBindingFiles(): Promise<Array<[string, string]>> {
  const root = path.resolve(import.meta.dirname, '../../../../..')
  const sourceRoot = path.join(root, 'e2e-apps/stateful-hmr/src')
  const source = readFileSync(path.join(sourceRoot, 'pages/wevu/index.vue'), 'utf8')
    .replace('../../shared/store', 'virtual:companion-store')
  const templateB = source.replace('<input v-model="input"', '<view class="sfc-template">SFC-TEMPLATE-B</view>\n    <input v-model="input"')
  const scriptPatch = source
    .replace('STATEFUL-WEVU-BASE', 'STATEFUL-WEVU-PATCHED')
    .replace('count.value += 1', 'count.value += 2')
    .replace('store.increment(1)', 'store.increment(2)')
  const compiled = await compileVueHmrSequence(root, source, [templateB, source, scriptPatch], {
    type: 'page',
    modules: {
      'virtual:companion-store': `import { createStore, setActivePinia } from 'wevu';
        setActivePinia(createStore());
        ${readFileSync(path.join(sourceRoot, 'shared/store.ts'), 'utf8')}`,
    },
  })
  const control = createStatefulHmrControlSource({ buildId: 'store-bindings', token: 'fixture', url: 'https://fixture.invalid/hmr' })
  return [
    ...compiled.initialFiles,
    ...compiled.templates.map((template, index): [string, string] => [`fixture/templates/${index}.wxml`, template]),
    ['project.config.json', JSON.stringify({ miniprogramRoot: '.', compileType: 'miniprogram' })],
    ['app.json', JSON.stringify({ pages: ['pages/wevu/index'] })],
    ['hmr-client.js', `
      const reports = [];
      (function(wx) { ${control} })({
        request(options) {
          reports.push(JSON.parse(JSON.stringify(options.data)));
          if (options.data.action === 'register') options.success({ data: { type: 'registered' } });
          return { abort() {} };
        }
      });
      module.exports = reports;
    `],
    ['patches.js', `module.exports = [${compiled.patches.map(patch => `{
      changedIds: ${JSON.stringify(patch.changedIds)},
      apply() {
        ${patch.code}
      }
    }`).join(',')}];`],
    ['app.js', `App({
      applyEdit(index) {
        const patch = require('./patches.js')[index];
        globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.receiveBatch({
          buildId: 'store-bindings', fromVersion: index, targetVersion: index + 1, changedIds: patch.changedIds
        }, patch.apply);
      },
      version() { return globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion(); },
      reports() { return require('./hmr-client.js'); },
      reLaunch() {
        return new Promise((resolve, reject) => wx.reLaunch({ url: '/pages/wevu/index', success: resolve, fail: reject }));
      },
      flush() { return globalThis.__rolldown_runtime__.loadExports('vue-shared-runtime.js').nextTick(); }
    });`],
    ['pages/wevu/index.json', JSON.stringify({ component: true })],
    ['pages/wevu/index.wxml', compiled.template ?? ''],
    ['pages/wevu/index.js', `
      require('../../compiled-component.js');
      require('../../hmr-client.js');
      const bridge = globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__;
      for (const definition of bridge.takeNativeDefinitions('Component')) Component(definition);
    `],
  ]
}
