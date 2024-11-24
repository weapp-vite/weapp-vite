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
  const arrr = Array.from(new Set(arr))

  await fs.writeFile(
    path.resolve(import.meta.dirname, '../packages/weapp-vite/src/auto-import-components/builtin.ts'),
    `export const components = [
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
