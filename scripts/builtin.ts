import { fs } from '@weapp-core/shared/fs'
import axios from 'axios'
import * as cheerio from 'cheerio'
import path from 'pathe'

const CHINESE_RE = /[\u4E00-\u9FA5]/
const BUILTIN_COMPONENT_NAME_RE = /^[a-z][a-z0-9]*/

// 判断字符串是否包含中文
function containsChinese(text: string) {
  return CHINESE_RE.test(text)
}

async function main() {
  const { data } = await axios.get('https://developers.weixin.qq.com/miniprogram/dev/component/ad.html')

  const $ = cheerio.load(data)

  const arr = $('.main-container .sidebar ul.NavigationLevel__children .NavigationItem .NavigationItem__router-link').map((_, el) => {
    return $(el).text().trim()
  }).filter((_, value) => {
    return !containsChinese(value) && BUILTIN_COMPONENT_NAME_RE.test(value)
  })
  const arrr = [
    // 内置
    'wxs',
    'template',
    'block',
    'import',
    'include',
    // 组件
    ...Array.from(new Set(arr)),
  ]

  await fs.writeFile(
    path.resolve(import.meta.dirname, '../packages-runtime/wevu-compiler/src/auto-import-components/builtin.auto.ts'),
    `// 这个文件由根目录下的 scripts/builtin.ts 生成
// 需要更改应该改那个文件，不要修改这个文件！
export const components = [
${arrr
  .map((x) => {
    return `  '${x}',`
  })
  .join('\n')}
]
`,
  )
}

main()
