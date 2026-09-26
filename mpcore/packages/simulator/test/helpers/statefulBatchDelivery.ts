import { createStatefulHmrControlSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/runtimeSource'

/** 复用真实交付客户端，检查成功执行、失败版本及原始 payload 回报。 */
export function createStatefulBatchDeliveryFiles(): Array<[string, string]> {
  const control = createStatefulHmrControlSource({ buildId: 'batch-fixture', token: 'fixture', url: 'https://fixture.invalid/hmr' })
  return [
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'require("./control.js"); App({}); globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.payloadDelivered("app.js");'],
    ['control.js', `
      globalThis.reports = [];
      globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__ = { ready: true };
      globalThis.__rolldown_runtime__ = { prepareUpdate() {}, applyPreparedUpdate() {} };
      (function(wx) { ${control} })({
        request(options) {
          globalThis.reports.push(JSON.parse(JSON.stringify(options.data)));
          if (options.data.action === 'register') options.success({ data: { type: 'registered' } });
          return { abort() {} };
        }
      });
    `],
    ['pages/index/index.json', '{}'],
    ['pages/index/index.wxml', '<view id="utility" class="{{utility}}">{{count}}</view>'],
    ['pages/index/index.js', `
      Page({
        data: { utility: 'initial', count: 0 },
        patch() {
          globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.receiveBatch({
            buildId: 'batch-fixture', fromVersion: 0, targetVersion: 1, changedIds: []
          }, () => this.setData({ utility: 'py-5_d5', count: 1 }));
        },
        failPatch() {
          globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.receiveBatch({
            buildId: 'batch-fixture', fromVersion: 1, targetVersion: 2, changedIds: []
          }, () => { throw new Error('injected execution failure'); });
        },
        reports() { return globalThis.reports; }
      });
    `],
  ]
}
