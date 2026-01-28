import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs-extra'
import path from 'pathe'

// 判断字符串是否包含中文
function containsChinese(text: string) {
  const chineseRegex = /[\u4E00-\u9FA5]/ // 匹配中文字符的正则表达式
  return chineseRegex.test(text)
}

async function main() {
  const { data } = await axios.get('https://developers.weixin.qq.com/miniprogram/dev/component/ad.html')

  const $ = cheerio.load(data)

  const arr = $('.main-container .sidebar ul.NavigationLevel__children .NavigationItem .NavigationItem__router-link').map((_, el) => {
    return $(el).text().trim()
  }).filter((_, value) => {
    return !containsChinese(value) && /^[a-z][a-z0-9]*/.test(value)
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
    path.resolve(import.meta.dirname, '../packages/wevu-compiler/src/auto-import-components/builtin.auto.ts'),
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
