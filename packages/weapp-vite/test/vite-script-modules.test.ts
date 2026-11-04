import type { MpPlatform } from '@weapp-core/shared'
import type { InlineConfig } from 'vite'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getMiniProgramPlatformDescriptor, getMiniProgramScriptModuleOptions, getSupportedMiniProgramPlatforms } from '@weapp-core/shared'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../src/vite'

async function scriptFixture(platform: MpPlatform) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-script-platform-'))
  const descriptor = getMiniProgramPlatformDescriptor(platform)
  const extension = descriptor.outputExtensions
  const script = getMiniProgramScriptModuleOptions(platform, extension.wxs)
  const externalTag = `<${script.tag} ${script.sourceAttribute}="./helper.${extension.wxs}.ts" ${script.moduleAttribute}="helper"/>`
  const ordinaryTag = `<${script.tag} ${script.sourceAttribute} = './ordinary.js' ${script.moduleAttribute}="ordinary" lang="js"/>`
  const nativeTag = `<${script.tag} ${script.sourceAttribute}="./native.${extension.wxs}" ${script.moduleAttribute}="native"/>`
  const inlineTag = `<${script.tag} lang="ts" ${script.moduleAttribute}="inline">export default { label: (value: string) => value }</${script.tag}>`
  const nativeInlineCode = `${platform === 'alipay' ? 'export default' : 'module.exports ='} { label: function(value) { if(value < 2) { return "</${script.tag}><debug/>" }; return value } }`
  const nativeInlineTag = `<${script.tag} ${script.moduleAttribute}="nativeInline">${nativeInlineCode}</${script.tag}>`
  const nativeCode = platform === 'alipay' ? `import peer from './peer.sjs'; export default { label: function(value) { return peer.label(value) } }` : `var peer = require('./peer.${extension.wxs}'); module.exports = { label: function(value) { return value } }${extension.wxs === 'wxs' ? '\n/* native tail comment' : ''}`
  const peerCode = platform === 'alipay' ? `import native from './native.sjs'; export default { label: function(value) { return value } }` : `var native = require('./native.${extension.wxs}'); module.exports = { label: function(value) { return value } }`
  const files = {
    [descriptor.projectConfigFileName]: JSON.stringify({ appid: 'fixture-app', miniprogramRoot: 'dist', smartProgramRoot: 'dist' }),
    'package.json': JSON.stringify({ name: 'platform-script-consumer', type: 'module' }),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/pages/home/index.ts': 'Page({data:{message:"platform-script-host"}})',
    'src/pages/home/index.json': '{}',
    [`src/pages/home/helper.${extension.wxs}.ts`]: 'import label from "./shared"; export default { label: (value: string) => label(value) }',
    'src/pages/home/shared.ts': 'export default function label(value: string) { return value }',
    'src/pages/home/ordinary.js': 'export default { label: value => value }',
    [`src/pages/home/native.${extension.wxs}`]: nativeCode,
    [`src/pages/home/peer.${extension.wxs}`]: peerCode,
    [`src/pages/home/index.${extension.wxml}`]: `${externalTag}${ordinaryTag}${nativeTag}${inlineTag}${nativeInlineTag}<view>{{helper.label(message)}} {{inline.label(message)}} {{native.label(message)}}</view>`,
    [`src/pages/home/index.${extension.wxss}`]: 'view { color: red; }',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  const config: InlineConfig = {
    root,
    configFile: false,
    plugins: [weapp()],
    logLevel: 'silent',
    weapp: { platform, srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'classic' } },
    build: { minify: false, write: false },
  }
  return { root, extension, script, config, nativeCode, peerCode, nativeInlineCode }
}

it.each(getSupportedMiniProgramPlatforms())('builds native %s template script modules with the platform contract', async (platform) => {
  const { root, extension, script, config, nativeCode, peerCode, nativeInlineCode } = await scriptFixture(platform)
  try {
    const result = await build(config)
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected one platform bundle')
    }
    const asset = (name: string) => {
      const output = result.output.find(output => output.fileName === name)
      expect(output, name).toBeDefined()
      return output?.type === 'asset' ? String(output.source) : ''
    }
    const template = asset(`pages/home/index.${extension.wxml}`)
    expect(template).toContain(`<${script.tag}`)
    expect(template).toContain(nativeInlineCode)
    expect(template).toContain(`${script.sourceAttribute}="./helper.${extension.wxs}"`)
    expect(template).not.toContain('lang="ts"')
    expect(template).toContain(`${script.sourceAttribute} = './ordinary.${extension.wxs}'`)
    const helper = asset(`pages/home/helper.${extension.wxs}`)
    expect(asset(`pages/home/ordinary.${extension.wxs}`)).toContain(script.format === 'esm' ? 'export default' : 'module.exports')
    expect(asset(`pages/home/shared.${extension.wxs}`)).toContain(script.format === 'esm' ? 'export default' : 'module.exports')
    expect(asset(`pages/home/native.${extension.wxs}`)).toBe(nativeCode)
    expect(asset(`pages/home/peer.${extension.wxs}`)).toBe(peerCode)
    expect(helper).not.toContain(': string')
    expect(helper).toContain(script.format === 'esm' ? 'export default' : 'module.exports')
    expect(template).toContain(script.format === 'esm' ? 'export default' : 'module.exports')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

it('builds Baidu native and typed Filter modules without parsing script strings as markup', async () => {
  const { root, config } = await scriptFixture('swan')
  const native = 'export default { label(value) { if (value < 2) { return "</filter><debug/>" }; return "ok" } }'
  const inline = 'export default { label(value) { if (value < 2) { return "</filter><view/>" }; return "ok" } }'
  try {
    await writeFile(path.join(root, 'src/pages/home/native.filter.js'), native)
    await writeFile(path.join(root, 'src/pages/home/typed.filter.ts'), 'export default { label: (value: string) => value }')
    await writeFile(path.join(root, 'src/pages/home/index.swan'), `<filter module="native" src="./native.filter.js"/><filter module="typed" src="./typed.filter.ts"/><filter module="inline">${inline}</filter><filter module="typedInline" lang="ts">export default { label: (value: string) => value }</filter><view>{{native.label(value)}} {{typed.label(value)}}</view>`)
    const result = await build(config)
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected one platform bundle')
    }
    const asset = (name: string) => {
      const output = result.output.find(output => output.fileName === name)
      expect(output, name).toBeDefined()
      return output?.type === 'asset' ? String(output.source) : ''
    }
    const template = asset('pages/home/index.swan')
    expect(template).toContain('<filter module="native" src="./native.filter.js"')
    expect(template).toContain('<filter module="typed" src="./typed.filter.js"')
    expect(template).toContain(inline)
    expect(template).not.toContain('lang="ts"')
    expect(template).not.toContain(': string')
    expect(asset('pages/home/native.filter.js')).toBe(native)
    expect(asset('pages/home/typed.filter.js')).toContain('export default')
    expect(asset('pages/home/typed.filter.js')).not.toContain(': string')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

it('preserves native JD JDS modules and recursive require paths beside portable WXS output', async () => {
  const { root, config } = await scriptFixture('jd')
  const main = '// JD module\r\nvar peer = require("./peer.jds"); var shared = require("./shared-native.js"); module.exports = { value: peer.value + shared.value }\r\n'
  const peer = 'var main = require("./native.jds"); module.exports = { value: 42 }\n'
  const shared = 'module.exports = { value: 1 }\r\n'
  const inline = '<jds module="inline">var html = "</jds><debug data-test=\'keep\'/><!--keep-->"; module.exports = {};</jds>'
  const visited: string[] = []
  config.weapp = {
    ...config.weapp,
    wxml: {
      remove: { attr: ['data-test', 'src'], comment: true },
      transform: (source, context) => context.edit(source, (node) => {
        visited.push(`edit:${node.tagName}`)
        if (node.tagName === 'view') {
          node.setAttribute('title', 'edited')
        }
      }),
      async validate(_source, context) {
        await context.walk((node) => {
          visited.push(`validate:${node.tagName}`)
        })
      },
    },
  }
  try {
    await writeFile(path.join(root, 'src/pages/home/native.jds'), main)
    await writeFile(path.join(root, 'src/pages/home/peer.jds'), peer)
    await writeFile(path.join(root, 'src/pages/home/shared-native.js'), shared)
    await writeFile(path.join(root, 'src/pages/home/index.jxml'), `<jds src="./native.jds" module="native"/>${inline}<wxs src="./helper.wxs.ts" module="portable"/><view data-test="drop">{{native.value}}</view>`)
    const result = await build(config)
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected one JD platform bundle')
    }
    const asset = (name: string) => {
      const output = result.output.find(output => output.fileName === name)
      expect(output, name).toBeDefined()
      return output?.type === 'asset' ? String(output.source) : ''
    }
    const template = asset('pages/home/index.jxml')
    expect(template).toContain('<jds src="./native.jds" module="native"/>')
    expect(template).toContain(inline)
    expect(template).toContain('<wxs src="./helper.wxs" module="portable"/>')
    expect(template).toContain('<view  title="edited">')
    expect(asset('pages/home/native.jds')).toBe(main)
    expect(asset('pages/home/peer.jds')).toBe(peer)
    expect(asset('pages/home/shared-native.js')).toBe(shared)
    expect(asset('pages/home/helper.wxs')).not.toContain(': string')
    expect(result.output.filter(output => output.fileName.endsWith('.jds'))).toHaveLength(2)
    expect(result.output.some(output => output.fileName === 'pages/home/native.wxs')).toBe(false)
    expect(visited).toContain('edit:jds')
    expect(visited).toContain('validate:jds')
    expect(visited).not.toContain('edit:debug')
    expect(visited).not.toContain('validate:debug')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
