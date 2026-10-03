import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const kinds = ['native', 'wevu', 'tailwind', 'web']

/** 四个输入只增加对应能力；不为原生消费者显式添加 Wevu、Tailwind 或测试依赖。 */
export function consumerFixture(kind, candidateVersion = '7.4.0') {
  assert(kinds.includes(kind), 'Unknown consumer kind')
  const dependencies = { 'weapp-vite': candidateVersion }
  const sfc = kind === 'wevu' || kind === 'web'
  if (sfc) {
    dependencies.wevu = candidateVersion
  }
  if (kind === 'tailwind') {
    dependencies.tailwindcss = '4.3.3'
  }
  const config = { srcRoot: 'src', autoRoutes: false, mcp: false, vue: { enable: sfc }, tailwindcss: false }
  if (kind === 'tailwind') {
    config.tailwindcss = { cssEntries: ['src/app.css'], rem2rpx: false }
  }
  if (kind === 'web') {
    config.platform = 'web'
  }
  const files = {
    'package.json': `${JSON.stringify({ name: `provider-cost-${kind}`, private: true, type: 'module', dependencies }, null, 2)}\n`,
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'weapp-vite.config.mjs': `import { defineConfig } from 'weapp-vite'\nexport default defineConfig({ weapp: ${JSON.stringify(config)} })\n`,
  }
  if (sfc) {
    files['src/app.vue'] = '<script setup>defineAppJson({ pages: ["pages/index/index"] })</script>\n'
    files['src/pages/index/index.vue'] = `<script setup>import { ref } from "wevu"; const value = ref("provider-cost-${kind}")</script><template><view>{{value}}</view></template>\n`
  }
  else {
    files['src/app.js'] = `${kind === 'tailwind' ? 'import "./app.css"; ' : ''}App({})\n`
    files['src/app.json'] = '{"pages":["pages/index/index"]}\n'
    files['src/pages/index/index.js'] = `Page({ data: { value: "provider-cost-${kind}" } })\n`
    files['src/pages/index/index.json'] = '{}\n'
    files['src/pages/index/index.wxml'] = kind === 'tailwind' ? '<view class="w-[37px]">{{value}}</view>\n' : '<view>{{value}}</view>\n'
    if (kind === 'tailwind') {
      files['src/app.css'] = '@import "tailwindcss";\n@source "./**/*.wxml";\n'
    }
  }
  if (kind === 'web') {
    files['index.html'] = '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="app"></div><script type="module" src="/@weapp-vite/web/entry"></script></body></html>\n'
  }
  return files
}

export async function writeFixture(root, kind, candidates) {
  const files = consumerFixture(kind)
  const manifest = JSON.parse(files['package.json'])
  for (const name of Object.keys(manifest.dependencies)) {
    if (candidates[name]) {
      manifest.dependencies[name] = candidates[name]
    }
  }
  files['package.json'] = `${JSON.stringify(manifest, null, 2)}\n`
  // pnpm 的独立工作区覆盖候选闭包，无需把这些包全部提升为消费者直接依赖。
  files['pnpm-workspace.yaml'] = `packages: []\nstrictPeerDependencies: true\nengineStrict: true\nallowBuilds:\n  '@swc/core': true\n  esbuild: true\n`
    + `overrides:\n${Object.entries(candidates).map(([name, specifier]) => `  ${JSON.stringify(name)}: ${JSON.stringify(specifier)}`).join('\n')}\n`
  for (const [file, source] of Object.entries(files)) {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  return files
}

/** 构建目标必须包含对应能力的可观察产物；不会把 CLI help 视为功能启动。 */
export async function assertConsumerOutput(root, kind) {
  if (kind === 'web') {
    assert((await readFile(path.join(root, 'dist/web/index.html'), 'utf8')).includes('<script'), 'Web consumer did not produce browser entry')
    return
  }
  for (const extension of ['js', 'json', 'wxml']) {
    assert((await readFile(path.join(root, `dist/pages/index/index.${extension}`))).byteLength > 0, 'Missing mini-program page output')
  }
  if (kind === 'tailwind') {
    const { readEmittedStylesheet } = await import('../../e2e/utils/emittedStylesheet.ts')
    assert.match(await readEmittedStylesheet(path.join(root, 'dist/app.wxss')), /width:\s*37px/)
  }
}
