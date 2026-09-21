import path from 'node:path'
import { rolldown } from 'rolldown'

/** 使用真实 wevu 与 #1049 共享 Store，生成 Node/browser 共用的小程序文件。 */
export async function createStoreLifecycleFiles(): Promise<Array<[string, string]>> {
  const root = path.resolve(import.meta.dirname, '../../../../..')
  const bundle = await rolldown({
    cwd: root,
    tsconfig: false,
    input: 'virtual:store-lifecycle',
    transform: { define: { 'process.env.NODE_ENV': JSON.stringify('test') } },
    plugins: [{
      name: 'store-lifecycle-runtime',
      resolveId: id => id === 'virtual:store-lifecycle' ? id : id === 'wevu' ? path.join(root, 'packages-runtime/wevu/src/index.ts') : undefined,
      load: id => id === 'virtual:store-lifecycle'
        ? `export { createApp, createWevuComponent } from ${JSON.stringify(path.join(root, 'packages-runtime/wevu/src/runtime/index.ts'))};
           export { nextTick } from ${JSON.stringify(path.join(root, 'packages-runtime/wevu/src/scheduler.ts'))};
           export { ref } from ${JSON.stringify(path.join(root, 'packages-runtime/wevu/src/reactivity/index.ts'))};
           export { createStore, storeToRefs } from ${JSON.stringify(path.join(root, 'packages-runtime/wevu/src/store/index.ts'))};
           export * from ${JSON.stringify(path.join(root, 'e2e-apps/github-issues/src/shared/issue1049Store.ts'))};`
        : undefined,
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs', entryFileNames: 'runtime.js' })
    const files: Array<[string, string]> = output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code])
    files.push(
      ['project.config.json', JSON.stringify({ miniprogramRoot: '.', compileType: 'miniprogram' })],
      ['app.json', JSON.stringify({ pages: ['pages/launch/index', 'pages/result/index'] })],
      ['app.js', `const r = require('./runtime.js'); r.createApp({}).use(r.createStore());`],
      ['pages/launch/index.json', JSON.stringify({ usingComponents: { subscriber: '/components/subscriber/index' } })],
      ['pages/result/index.json', '{}'],
      ['components/subscriber/index.json', '{"component":true}'],
      ['components/subscriber/index.wxml', '<view id="child">subscribed</view>'],
      ['components/subscriber/index.js', `const r = require('../../runtime.js');
        r.createWevuComponent({ setup() {
          r.useIssue1049Store().$subscribe(() => r.metrics.child++, { flush: 'sync' });
          return {};
        }});`],
      ['pages/launch/index.wxml', '<view id="count">{{ count }}</view><subscriber wx:if="{{visible}}" />'],
      ['pages/result/index.wxml', '<view id="count">{{ count }}</view><view id="doubled">{{ doubled }}</view>'],
      ['pages/launch/index.js', `const r = require('../../runtime.js');
        r.createWevuComponent({ setup() {
          r.resetScenario();
          const store = r.useIssue1049Store();
          const visible = r.ref(true);
          store.$subscribe(() => r.metrics.page++, { flush: 'sync' });
          store.$subscribe(() => r.metrics.detached++, { flush: 'sync', detached: true });
          store.$onAction(({ after, onError, name }) => {
            if (name === 'wait') after(() => r.metrics.after++);
            if (name === 'reject') onError(() => r.metrics.errors++);
          });
          return {
            ...r.storeToRefs(store), visible,
            flush: () => r.nextTick(),
            remove: () => { visible.value = false; return r.nextTick(); },
            mutate: () => { store.increment(); return r.nextTick(); },
            start: () => { void store.wait(); void store.reject().catch(() => {}); },
            snapshot: r.snapshot,
          };
        }});`],
      ['pages/result/index.js', `const r = require('../../runtime.js');
        r.createWevuComponent({ setup() {
          const store = r.useIssue1049Store();
          return {
            ...r.storeToRefs(store), flush: () => r.nextTick(),
            mutate: () => { store.increment(); return r.nextTick(); },
            finish: r.settleActions, snapshot: r.snapshot,
            dispose: () => { store.$dispose(); return r.useIssue1049Store().count; },
          };
        }});`],
    )
    return files
  }
  finally {
    await bundle.close()
  }
}
