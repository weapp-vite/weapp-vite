import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

const sourceUrl = new URL('../../wevu/components.weapp.json', import.meta.url)
const outputUrl = new URL('../src/compiler/wxml/nativeTags.ts', import.meta.url)
const definitions = JSON.parse(await readFile(sourceUrl, 'utf8'))
const names = [...new Set(definitions.map(entry => entry.name))].sort()
const output = '// 本文件由 components.weapp.json 生成，请运行 node packages-runtime/web/scripts/generate-native-tags.mjs。\n'
  + `export const NATIVE_COMPONENT_NAMES = new Set([\n${names.map(name => `  '${name}',`).join('\n')}\n])\n`

if (process.argv.includes('--check')) {
  if (await readFile(outputUrl, 'utf8') !== output) {
    throw new Error('原生组件名称清单已过期，请重新生成。')
  }
}
else {
  await writeFile(outputUrl, output)
}
