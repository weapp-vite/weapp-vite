import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

export const nativeLanguagePublicApiDependencies = ['@weapp-vite/language-service']

const profiles = [
  ['wxml', 'wx', 'wxs', 'wxss'],
  ['axml', 'a', 'sjs', 'acss'],
  ['ttml', 'tt', 'sjs', 'ttss'],
  ['swan', 's', 'sjs', 'css'],
  ['jxml', 'jd', 'wxs', 'jxss'],
  ['xhsml', 'xhs', 'wxs', 'css'],
  ['qml', 'qq', 'wxs', 'qss'],
  ['ksml', 'ks', 'ks', 'css'],
  ['tyml', 'ty', 'sjs', 'tyss'],
]

/** 真正安装后的组合 CLI 处理全部登记语言，并验证非法输入不能部分写回。 */
export async function verifyNativeLanguages(project, runScript, runStylelint, runTypes) {
  const root = path.join(project, 'language-fixtures')
  await fs.mkdir(root)
  const protectedText = '前缀  {{item.label}}  后缀'
  for (const [extension, prefix, script, style] of profiles) {
    const directory = path.join(root, extension)
    await fs.mkdir(directory)
    const moduleName = `./tools.${script}`
    const tag = extension === 'axml' ? `<import-sjs name="tools" from="${moduleName}" />` : extension === 'swan' ? `<import-sjs module="tools" src="${moduleName}" />` : `<${script} module="tools" src="${moduleName}" />`
    const loop = extension === 'swan' ? 's-for="item in list"' : `${prefix}:for="{{list}}"`
    await fs.writeFile(path.join(directory, `page.${extension}`), `${tag}<view   ${loop}><text>${protectedText}</text></view>\n`)
    await fs.writeFile(path.join(directory, `tools.${script}`), extension === 'axml' ? 'export default { label: function(value){return value} }\n' : 'function label(value){return value}\nmodule.exports={label:label}\n')
    if (extension === 'swan') {
      await fs.writeFile(path.join(directory, 'filter.swan'), '<filter module="native" src="./tools.filter.js"/><filter module="typed" src="./typed.filter.ts"/><filter module="inline">export default { label:function(value){return value} }</filter><filter lang="ts" module="compiled">export default { label:(value:string)=>value }</filter><text>  {{native.label(value)}}  </text>\n')
      await fs.writeFile(path.join(directory, 'tools.filter.js'), 'export default { label:function(value){return value} }\n')
      await fs.writeFile(path.join(directory, 'typed.filter.ts'), 'export default { label:(value:string)=>value }\n')
    }
    await fs.writeFile(path.join(directory, `page.${style}`), '/* #ifdef MP-WEIXIN */\npage{width:120rpx;--spacing:4rpx}/* #endif */\n')
  }
  await fs.writeFile(path.join(root, 'public-types.mts'), `import { analyzeDocument, formatTemplateResult, type SourceEdit } from '@weapp-vite/language-service'
import { analyzeProject, resolveProjectReference } from '@weapp-vite/language-service/project'
import { formatDocument } from '@weapp-vite/oxfmt/languages'
import { prepareProjectFormatting } from '@weapp-vite/oxfmt/project'
const edits: SourceEdit[] = formatTemplateResult('<view/>', 'page.axml').edits
const valid: boolean = analyzeDocument({ source: '<view/>', fileName: 'page.axml' }).valid
const formatted: Promise<string> = formatDocument('module.exports = {}', 'tools.wxs')
void [edits, valid, formatted, analyzeProject, resolveProjectReference, prepareProjectFormatting]
`)
  await fs.writeFile(path.join(root, 'tsconfig.public-types.json'), `${JSON.stringify({
    compilerOptions: {
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ES2022',
    },
    files: ['./public-types.mts'],
  }, null, 2)}\n`)
  await runScript('format', 'native-language-format')
  await runScript('lint', 'native-language-lint')
  await runScript('format:check', 'native-language-format-check')
  await runScript('check', 'native-language-check')
  await runStylelint()
  await runTypes(['exec', 'tsc', '--project', 'language-fixtures/tsconfig.public-types.json'])
  for (const [extension] of profiles) {
    assert((await fs.readFile(path.join(root, extension, `page.${extension}`), 'utf8')).includes(protectedText), `${extension} changed protected text`)
  }
  const invalid = path.join(root, 'invalid.wxml')
  await fs.writeFile(invalid, '<view>{{ value + }}</view>')
  const before = await fs.readFile(path.join(root, 'wxml', 'page.wxml'), 'utf8')
  try {
    await runScript('format', 'native-language-reject-write', /(?:表达式|expression|Unexpected)/)
    assert.equal(await fs.readFile(path.join(root, 'wxml', 'page.wxml'), 'utf8'), before, 'Invalid input allowed partial write')
    assert.equal(await fs.readFile(invalid, 'utf8'), '<view>{{ value + }}</view>')
  }
  finally {
    await fs.rm(invalid)
  }
  return { templates: profiles.map(([extension]) => extension), protectedText: true, rejectWrite: true }
}
