import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function importsConsumerConfig(toolchain, revision = 'config-before') {
  return `import { appendFileSync } from 'node:fs'
import { defineConfig } from '${toolchain === 'wv' ? 'weapp-vite' : toolchain}'
${toolchain === 'wv' ? '' : 'import { weapp } from \'weapp-vite/vite\''}
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default defineConfig({
  ${toolchain === 'wv' ? '' : 'plugins: [weapp()],'}
  define: { __IMPORTS_CONFIG__: JSON.stringify('${revision}') },
  weapp: { srcRoot: 'src', autoRoutes: false, mcp: false, hmr: { runtime: 'classic' }, worker: { entry: ['index'] } },
  build: { outDir: 'dist', minify: false },
})
`
}

/** 所有产物由实际 CLI 编译；这里仅创建消费者的输入文件。 */
export async function writeImportsFixture(root, toolchain) {
  const project = JSON.parse(await readFile(new URL('../../../../e2e-apps/github-issues/project.config.json', import.meta.url), 'utf8'))
  const source = `import text from '#text/value?raw'
import exact from '#exact?raw'
Page({ data: { text, exact, revision: __IMPORTS_CONFIG__ } })
`
  const files = {
    'vite.config.mts': importsConsumerConfig(toolchain),
    'tsconfig.json': '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","skipLibCheck":true}}',
    'project.config.json': JSON.stringify({ ...project, miniprogramRoot: 'dist' }),
    'project.private.config.json': JSON.stringify({ condition: { miniprogram: { list: [
      { name: 'imports main', pathName: 'pages/index/index', query: '' },
      { name: 'imports independent', pathName: 'independent/index/index', query: '' },
    ] } } }),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'independent', pages: ['index/index'], independent: true }], workers: 'workers' }),
    'src/pages/index/index.ts': source,
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view class="imports-text">{{text}}</view><view class="imports-exact">{{exact}}</view><view>{{revision}}</view>',
    'src/independent/index/index.ts': source,
    'src/independent/index/index.json': '{}',
    'src/independent/index/index.wxml': '<view class="imports-text">{{text}}</view><view class="imports-exact">{{exact}}</view>',
    'src/workers/index.ts': 'import text from "#text/value?raw"; console.log(text)',
    'src/data/value.js': 'export const marker = "imports-source-before"',
    'src/data/exact.js': 'export default "imports-exact-key"',
    'src/alternative/value.js': 'export const marker = "imports-mapping-after"',
  }
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
}
