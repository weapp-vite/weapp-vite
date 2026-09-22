import { readFileSync } from 'node:fs'
import path from 'node:path'
import { rolldown } from 'rolldown'

export const updatedStoreName = 'updated-default'

/** 切换 App 安装的 Pinia；页面 reLaunch 不会重新安装应用级插件。 */
export function storeDefinitionApp(variant: 'initial' | 'updated') {
  return `const r = require('./runtime.js'); r.createApp({}).use(r.${variant}.initStoreManager());`
}

/** 同时加载真实 fixture 的两版 Store 定义，保留同一份 wevu 运行时。 */
export async function createStoreDefinitionReloadFiles(): Promise<Array<[string, string]>> {
  const root = path.resolve(import.meta.dirname, '../../../../..')
  const source = readFileSync(path.join(root, 'e2e-apps/wevu-runtime-e2e/src/shared/store.ts'), 'utf8')
  const bundle = await rolldown({
    cwd: root,
    tsconfig: false,
    input: { runtime: 'virtual:store-definitions' },
    transform: { define: { 'process.env.NODE_ENV': JSON.stringify('test') } },
    plugins: [{
      name: 'store-definition-reload',
      resolveId: id => id.startsWith('virtual:store-') ? id : id === 'wevu' ? path.join(root, 'packages-runtime/wevu/src/index.ts') : undefined,
      load(id) {
        if (id === 'virtual:store-definitions') {
          return `export { createApp } from 'wevu'; export * as initial from 'virtual:store-initial'; export * as updated from 'virtual:store-updated';`
        }
        if (id === 'virtual:store-initial' || id === 'virtual:store-updated') {
          return {
            code: id === 'virtual:store-initial' ? source : source.replace('setupStoreInitialName = \'init\'', `setupStoreInitialName = '${updatedStoreName}'`),
            moduleType: 'ts',
          }
        }
      },
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs', entryFileNames: '[name].js' })
    const files: Array<[string, string]> = output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code])
    files.push(
      ['app.json', JSON.stringify({ pages: ['pages/initial/index', 'pages/updated/index'] })],
      ['app.js', storeDefinitionApp('initial')],
    )
    for (const variant of ['initial', 'updated']) {
      files.push(
        [`pages/${variant}/index.json`, '{}'],
        [`pages/${variant}/index.wxml`, '<view id="name">{{name}}</view><view id="plugin">{{plugin}}</view>'],
        [`pages/${variant}/index.js`, `const definition = require('../../runtime.js').${variant};
          Page({ onLoad() {
            const store = definition.useSetupStore();
            store.$reset();
            this.setData({ name: store.name, plugin: !!store.__pluginTouched && definition.getPluginRecords().includes('setupCounter') });
          } });`],
      )
    }
    return files
  }
  finally {
    await bundle.close()
  }
}
