import { readFileSync } from 'node:fs'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { compileVueFile } from 'wevu/compiler'

/** 直接编译真实 stateful HMR 页面，覆盖 Store 解包后的模板响应式绑定。 */
export async function createStatefulStoreBindingFiles(): Promise<Array<[string, string]>> {
  const root = path.resolve(import.meta.dirname, '../../../../..')
  const sourceRoot = path.join(root, 'e2e-apps/stateful-hmr/src')
  const pagePath = path.join(sourceRoot, 'pages/wevu/index.vue')
  const compiled = await compileVueFile(readFileSync(pagePath, 'utf8'), pagePath, { isPage: true })
  const bundle = await rolldown({
    cwd: root,
    tsconfig: false,
    input: { 'app': path.join(sourceRoot, 'app.ts'), 'pages/wevu/index': pagePath },
    transform: { define: { 'process.env.NODE_ENV': JSON.stringify('test') } },
    plugins: [{
      name: 'stateful-store-binding-fixture',
      resolveId(id) {
        if (id === 'wevu') {
          return path.join(root, 'packages-runtime/wevu/src/index.ts')
        }
        if (id.startsWith('virtual:weapp-vite/runtime')) {
          return path.join(root, `packages-runtime/wevu/src/${id.endsWith('/reactivity') ? 'internal-reactivity' : 'internal-runtime'}.ts`)
        }
      },
      load: id => id === pagePath ? { code: compiled.script as string, moduleType: 'js' } : undefined,
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name].js' })
    return [
      ...output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code] as [string, string]),
      ['project.config.json', JSON.stringify({ miniprogramRoot: '.', compileType: 'miniprogram' })],
      ['app.json', JSON.stringify({ pages: ['pages/wevu/index'] })],
      ['pages/wevu/index.json', JSON.stringify({ component: true })],
      ['pages/wevu/index.wxml', compiled.template ?? ''],
    ]
  }
  finally {
    await bundle.close()
  }
}
