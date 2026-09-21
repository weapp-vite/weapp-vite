import { readFileSync } from 'node:fs'
import path from 'node:path'
import { rolldown } from 'rolldown'

/** 复用真实 IDE HMR 页面与共享 Store，验证 action 替换后的响应式视图。 */
export async function createStoreHmrFiles(): Promise<Array<[string, string]>> {
  const root = path.resolve(import.meta.dirname, '../../../../..')
  const pageRoot = path.join(root, 'e2e-apps/wevu-runtime-e2e/src/pages/hmr')
  const bundle = await rolldown({
    cwd: root,
    tsconfig: false,
    input: { 'runtime': 'virtual:store-hmr', 'pages/hmr/index': path.join(pageRoot, 'index.ts') },
    transform: { define: { 'process.env.NODE_ENV': JSON.stringify('test') } },
    plugins: [{
      name: 'store-hmr-fixture',
      resolveId: id => id === 'virtual:store-hmr' ? id : id === 'wevu' ? path.join(root, 'packages-runtime/wevu/src/index.ts') : undefined,
      load: id => id === 'virtual:store-hmr'
        ? `export { createApp, nextTick } from 'wevu';
           export { initStoreManager } from ${JSON.stringify(path.join(root, 'e2e-apps/wevu-runtime-e2e/src/shared/store.ts'))};`
        : undefined,
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name].js' })
    const files: Array<[string, string]> = output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code])
    files.push(
      ['project.config.json', JSON.stringify({ miniprogramRoot: '.', compileType: 'miniprogram' })],
      ['app.json', JSON.stringify({ pages: ['pages/hmr/index'] })],
      ['app.js', 'const r = require(\'./runtime.js\'); r.createApp({}).use(r.initStoreManager());'],
      ['pages/hmr/index.json', '{}'],
      ['pages/hmr/index.wxml', readFileSync(path.join(pageRoot, 'index.wxml'), 'utf8')],
    )
    return files
  }
  finally {
    await bundle.close()
  }
}
