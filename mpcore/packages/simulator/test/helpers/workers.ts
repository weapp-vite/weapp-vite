export const workerFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index'], workers: { path: 'workers', isSubpackage: true } })],
  ['app.js', 'globalThis.workerScope = \"main\"; App({})'],
  ['pages/index.js', `Page({
    data: { message: 'waiting', count: 0 },
    onLoad() {
      wx.preDownloadSubpackage({ packageType: 'workers', success: () => {
        this.worker = wx.createWorker('workers/index.js');
        this.worker.onMessage(value => this.setData({ message: value.message, count: value.count, mainScope: globalThis.workerScope, workerScope: value.scope }));
      }});
    },
    send() { const value = { message: 'echo' }; this.worker.postMessage(value); value.message = 'mutated'; },
    onUnload() { this.worker?.terminate(); },
  })`],
  ['pages/index.wxml', '<view class="message">{{message}}</view><view class="count">{{count}}</view><button bindtap="send">send</button>'],
  ['workers/index.js', `const { hello } = require('./shared');
    let count = 0;
    globalThis.workerScope = 'worker';
    worker.onMessage(value => worker.postMessage({ message: value.message, count: ++count, scope: globalThis.workerScope }));
    worker.postMessage({ message: hello, count, scope: globalThis.workerScope });`],
  ['workers/shared.js', 'exports.hello = "worker hello";'],
]
