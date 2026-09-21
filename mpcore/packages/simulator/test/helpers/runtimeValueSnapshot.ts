import path from 'node:path'
import { rolldown } from 'rolldown'

/** 将真实 IDE 的快照采样器放入 simulator 宿主，覆盖响应式代理与异步节点查询。 */
export async function createRuntimeValueSnapshotFiles(): Promise<Array<[string, string]>> {
  const root = path.resolve(import.meta.dirname, '../../../../..')
  const bundle = await rolldown({
    cwd: root,
    tsconfig: false,
    input: 'virtual:runtime-snapshot-page',
    plugins: [{
      name: 'runtime-snapshot-fixture',
      resolveId: id => id === 'virtual:runtime-snapshot-page' ? id : undefined,
      load: id => id === 'virtual:runtime-snapshot-page'
        ? `
        import { reactive } from ${JSON.stringify(path.join(root, 'packages-runtime/wevu/src/internal-reactivity.ts'))};
        import { collectRuntimeValueSnapshot } from ${JSON.stringify(path.join(root, 'e2e/utils/runtimeValueSnapshot.ts'))};
        Page({
          data: { count: 0 },
          onLoad() {
            const state = reactive({ count: 0, nested: { marker: 'ready' } });
            this.__wevu = { state, setupState: state };
          },
          increment() {
            this.__wevu.state.count++;
            this.setData({ count: this.__wevu.state.count });
          },
          snapshot() { return collectRuntimeValueSnapshot(['.count', '.missing']); }
        });`
        : undefined,
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs', entryFileNames: 'pages/index/index.js' })
    return [
      ...output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code] as [string, string]),
      ['project.config.json', JSON.stringify({ miniprogramRoot: '.', compileType: 'miniprogram' })],
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.json', '{}'],
      ['pages/index/index.wxml', '<view class="count">{{count}}</view>'],
    ]
  }
  finally {
    await bundle.close()
  }
}
