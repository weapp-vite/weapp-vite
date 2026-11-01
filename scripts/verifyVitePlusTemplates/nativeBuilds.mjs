import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const contracts = [
  { platform: 'weapp', template: 'wxml', style: 'wxss', script: 'wxs', tag: 'wxs', source: 'src', module: 'module', format: 'commonjs', project: 'project.config.json' },
  { platform: 'alipay', template: 'axml', style: 'acss', script: 'sjs', tag: 'import-sjs', source: 'from', module: 'name', format: 'esm', project: 'mini.project.json' },
  { platform: 'tt', template: 'ttml', style: 'ttss', script: 'sjs', tag: 'sjs', source: 'src', module: 'module', format: 'commonjs', project: 'project.config.json' },
  { platform: 'swan', template: 'swan', style: 'css', script: 'sjs', tag: 'import-sjs', source: 'src', module: 'module', format: 'esm', project: 'project.swan.json' },
  { platform: 'jd', template: 'jxml', style: 'jxss', script: 'wxs', tag: 'wxs', source: 'src', module: 'module', format: 'commonjs', project: 'project.config.json' },
  { platform: 'xhs', template: 'xhsml', style: 'css', script: 'wxs', tag: 'wxs', source: 'src', module: 'module', format: 'commonjs', project: 'project.config.json' },
]

export const nativeBuildPlatforms = contracts.map(contract => contract.platform)

/** 消费者输入使用明确的宿主契约，避免从被测编译器反推期望值。 */
export function createNativeBuildFixture(platform) {
  const contract = contracts.find(contract => contract.platform === platform)
  assert(contract, `Unknown native build platform: ${platform}`)
  const { template, style, script, tag, source, module } = contract
  const protectedText = '前缀  {{message}}  后缀'
  const nativeCode = platform === 'alipay'
    ? 'import peer from "./peer.sjs"; export default { label: function(value) { return peer.label(value) } }'
    : `var peer = require('./peer.${script}'); module.exports = { label: function(value) { return value } }${script === 'wxs' ? '\n/* native tail comment' : ''}`
  const peerCode = platform === 'alipay' ? 'import native from "./native.sjs"; export default { label: function(value) { return value } }' : `var native = require('./native.${script}'); module.exports = { label: function(value) { return value } }`
  const nativeInline = `${platform === 'alipay' ? 'export default' : 'module.exports ='} { label: function(value) { if (value < 2) { return "</${tag}><debug/>" }; return value } }`
  const declaration = (name, value, lang = '') => `<${tag} ${source} = '${value}' ${module}="${name}"${lang ? ` lang="${lang}"` : ''}/>`
  let page = [
    declaration('native', `./native.${script}`),
    declaration('typed', `./typed.${script}.ts`),
    declaration('ordinary', './ordinary.js', 'js'),
    `<${tag} ${module}="nativeInline">${nativeInline}</${tag}>`,
    `<${tag} lang="ts" ${module}="typedInline">export default { label: (value: string) => value }</${tag}>`,
    `<view><text>${protectedText}</text><text>{{typed.label(message)}}</text></view>`,
  ].join('')
  const nativeFilter = 'export default { label(value) { if (value < 2) { return "</filter><debug/>" }; return "ok" } }'
  const files = {
    'package.json': JSON.stringify({ name: `native-${platform}-consumer`, private: true, type: 'module' }),
    [contract.project]: JSON.stringify({ appid: 'fixture-app', miniprogramRoot: 'dist', smartProgramRoot: 'dist' }),
    'vite.config.mts': `import { defineConfig } from 'vite-plus'
import { weapp } from 'weapp-vite/vite'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [weapp()],
  weapp: {
    platform: '${platform}',
    srcRoot: 'src',
    autoRoutes: false,
    vue: { enable: false },
    hmr: { runtime: 'classic' },
  },
  build: { outDir: 'dist', minify: false },
})
`,
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/pages/home/index.ts': 'Page({ data: { message: "native-consumer" } })',
    'src/pages/home/index.json': '{}',
    [`src/pages/home/index.${style}`]: 'view { width: 120rpx; --spacing: 4rpx; }',
    [`src/pages/home/native.${script}`]: nativeCode,
    [`src/pages/home/peer.${script}`]: peerCode,
    [`src/pages/home/typed.${script}.ts`]: 'import label from "./shared"; export default { label: (value: string) => label(value) }',
    'src/pages/home/shared.ts': 'export default function label(value: string) { return value }',
    'src/pages/home/ordinary.js': 'export default { label: value => value }',
  }
  if (platform === 'swan') {
    files['src/pages/home/native.filter.js'] = nativeFilter
    files['src/pages/home/typed.filter.ts'] = 'export default { label: (value: string) => value }'
    page += `<filter src="./native.filter.js" module="nativeFilter"/><filter src="./typed.filter.ts" module="typedFilter"/><filter module="inlineFilter">${nativeFilter}</filter><filter lang="ts" module="typedInlineFilter">export default { label: (value: string) => value }</filter>`
  }
  files[`src/pages/home/index.${template}`] = page
  return { contract, files, protectedText, nativeCode, peerCode, nativeInline, nativeFilter }
}

async function assertNativeBuildOutputs(directory, fixture) {
  const { contract, protectedText, nativeCode, peerCode, nativeInline, nativeFilter } = fixture
  const { platform, template, style, script, tag, source, format } = contract
  const output = path.join(directory, 'dist')
  const read = file => fs.readFile(path.join(output, file), 'utf8')
  for (const file of ['app.js', 'app.json', 'pages/home/index.js', 'pages/home/index.json', `pages/home/index.${style}`]) {
    assert((await fs.stat(path.join(output, file))).isFile(), `Missing ${platform} ${file}`)
  }
  const page = await read(`pages/home/index.${template}`)
  assert(page.includes(`<${tag}`), `${platform} script module tag changed`)
  assert(page.includes(`${source} = './ordinary.${script}'`), `${platform} ordinary JavaScript module path was not compiled`)
  assert(page.includes(protectedText), `${platform} changed protected template text`)
  assert(page.includes(nativeInline), `${platform} changed native inline script bytes`)
  assert(!page.includes('lang="ts"') && !page.includes('lang="js"'), `${platform} retained build-only lang attribute`)
  assert(!page.includes(': string'), `${platform} retained inline TypeScript`)
  assert.equal(await read(`pages/home/native.${script}`), nativeCode, `${platform} changed native script bytes`)
  assert.equal(await read(`pages/home/peer.${script}`), peerCode, `${platform} dropped a native script graph dependency`)
  for (const name of ['typed', 'shared', 'ordinary']) {
    const code = await read(`pages/home/${name}.${script}`)
    assert(!code.includes(': string'), `${platform} retained TypeScript in ${name}`)
    assert(format === 'esm' ? code.includes('export default') : /module\.exports\s*=/.test(code), `${platform} emitted the wrong module format in ${name}`)
  }
  if (platform === 'swan') {
    assert.equal(await read('pages/home/native.filter.js'), nativeFilter)
    assert(page.includes(nativeFilter), 'Baidu changed native inline Filter bytes')
    assert(page.includes('src="./typed.filter.js"'), 'Baidu retained a Filter TypeScript path')
    const filter = await read('pages/home/typed.filter.js')
    assert(filter.includes('export default') && !filter.includes(': string'), 'Baidu Filter compilation changed its JavaScript module contract')
  }
  return { platform, nativeBytes: true, inlineBytes: true, typedModules: true, ordinaryJavaScript: true, extensionlessImports: true, ...(platform === 'swan' ? { filter: true } : {}) }
}

/** 每个子项目通过已安装的候选 vp 与公开插件入口构建，不使用仓库源码。 */
export async function verifyNativeBuilds(project, runTool) {
  const root = path.join(project, 'native-builds')
  await fs.mkdir(root)
  const results = []
  for (const platform of nativeBuildPlatforms) {
    const fixture = createNativeBuildFixture(platform)
    const directory = path.join(root, platform)
    for (const [file, contents] of Object.entries(fixture.files)) {
      const target = path.join(directory, file)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, contents)
    }
    await runTool(`native-build-${platform}`, ['exec', 'vp', 'build', '--config', `native-builds/${platform}/vite.config.mts`])
    results.push(await assertNativeBuildOutputs(directory, fixture))
  }
  return { platforms: results }
}
