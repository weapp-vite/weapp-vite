import { createStatefulHmrControlSource } from '../../../../../packages/weapp-vite/src/runtime/statefulHmr/runtimeSource'

/** 复用真实交付客户端，检查成功执行、失败版本及原始 payload 回报。 */
export function createStatefulBatchDeliveryFiles(): Array<[string, string]> {
  const control = createStatefulHmrControlSource({ buildId: 'batch-fixture', token: 'fixture', url: 'https://fixture.invalid/hmr' })
  return [
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'require("./control.js"); App({}); globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.payloadDelivered("app.js");'],
    ['control.js', `
      globalThis.reports = [];
      globalThis.clientTimers = new Map();
      const runtimeSetTimeout = setTimeout;
      const runtimeClearTimeout = clearTimeout;
      globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__ = { ready: true };
      globalThis.__rolldown_runtime__ = { prepareUpdate() {}, applyPreparedUpdate() {} };
      (function(wx, setTimeout, clearTimeout) { ${control} })({
        request(options) {
          globalThis.reports.push(JSON.parse(JSON.stringify(options.data)));
          if (options.data.action === 'poll') globalThis.pendingPoll = options;
          if (options.data.action === 'register') options.success({ data: { type: 'registered' } });
          return { abort() {} };
        }
      }, (callback, delay) => {
        const handle = runtimeSetTimeout(() => {
          globalThis.clientTimers.delete(handle);
          callback();
        }, delay);
        globalThis.clientTimers.set(handle, delay);
        return handle;
      }, handle => {
        globalThis.clientTimers.delete(handle);
        runtimeClearTimeout(handle);
      });
    `],
    ['pages/index/index.json', '{}'],
    ['pages/index/index.wxml', '<view id="utility" class="{{utility}}">{{count}}</view>'],
    ['pages/index/index.js', `
      Page({
        data: { utility: 'initial', count: 0 },
        publishBatch() {
          globalThis.pendingPoll.success({ statusCode: 200, data: { type: 'batch-published' } });
        },
        pendingTimers() { return [...globalThis.clientTimers.values()]; },
        stopClient() { globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.stop(); },
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
