import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台进程入口验证临时发布包消费者。
import { execa } from 'execa'
import { readEmittedStylesheet } from '../../../e2e/utils/emittedStylesheet.ts'

/** 在现有原生/SFC 独立消费者上启用 Tailwind，验证能力延迟加载及两种 HMR 路径。 */
export async function verifyTailwindConsumer(root, host) {
  const require = createRequire(path.join(root, 'package.json'))
  const packageName = host === 'wv' ? 'weapp-vite' : host
  const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), host === 'wv' ? 'bin/weapp-vite.js' : host === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
  const configFile = path.join(root, 'vite.config.mts')
  const config = await readFile(configFile, 'utf8')
  await writeFile(configFile, config.replace('mcp: false', 'mcp: false, tailwindcss: { cssEntries: [\'src/app.css\'], rem2rpx: false }'))
  await writeFile(path.join(root, 'src/app.css'), '@import "tailwindcss";\n@source "./**/*.{wxml,vue}";\n')
  await writeFile(path.join(root, 'src/app.ts'), 'import "./app.css"; App({})')
  await writeFile(path.join(root, 'src/pages/native/index.wxml'), '<view class="w-[37px]">{{message}}</view>')
  await execa(process.execPath, [cli, 'build'], { cwd: root, stdio: 'inherit' })
  assert.match(await readEmittedStylesheet(path.join(root, 'dist/app.wxss')), /width:\s*37px/)
  const template = await readFile(path.join(root, 'dist/pages/native/index.wxml'), 'utf8')
  assert.match(template, /class="[^"]+"/)
  assert(!template.includes('w-[37px]'), 'Mini-program utility class must be escaped')
  for (const operation of ['dev', 'stateful-dev']) {
    await execa(process.execPath, [fileURLToPath(new URL('./verify-vite-host-dev.mjs', import.meta.url)), root, host, operation, 'tailwind'], { cwd: root, stdio: 'inherit' })
  }
  console.log(`${host}: packed Tailwind native build, classic/stateful class update and restore passed`)
}
