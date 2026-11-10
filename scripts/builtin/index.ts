import axios from 'axios'
import * as cheerio from 'cheerio'

export const WECHAT_COMPONENTS_URL = 'https://developers.weixin.qq.com/miniprogram/dev/component/ad.html'
const FIXED_TAGS = ['wxs', 'template', 'block', 'import', 'include']
const COMPONENT_PATH_RE = /^\/miniprogram\/dev\/component\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.html$/

/** 根据组件文档地址与标签文本提取名称，不依赖导航的布局结构。 */
export function extractBuiltinComponents(html: string): string[] {
  const $ = cheerio.load(html)
  const names = new Set<string>()
  const source = new URL(WECHAT_COMPONENTS_URL)
  for (const element of $('a[href]').toArray()) {
    const anchor = $(element)
    let link: URL
    try {
      link = new URL(anchor.attr('href')!, source)
    }
    catch {
      continue
    }
    const name = COMPONENT_PATH_RE.exec(link.pathname)?.[1]
    if (link.origin === source.origin && name && anchor.text().trim() === name) {
      names.add(name)
    }
  }
  return [...names]
}

/** 在写入前验证完整性，禁止抓取失败或文档缺项导致自动删除。 */
export function validateBuiltinComponents(names: string[], previousComponents: readonly string[]) {
  if (!names.length) {
    throw new Error(`No component names extracted from ${WECHAT_COMPONENTS_URL}`)
  }
  const components = [...new Set([...FIXED_TAGS, ...names])]
  const current = new Set(components)
  const missing = previousComponents.filter(name => !current.has(name))
  if (missing.length) {
    throw new Error(`Refusing to remove existing components from ${WECHAT_COMPONENTS_URL}: ${missing.join(', ')}`)
  }
  return components
}

/** 保持生成文件格式稳定，避免无意义的重排和格式差异。 */
export function renderBuiltinComponents(components: readonly string[]) {
  return `// 这个文件由根目录下的 scripts/builtin.ts 生成
// 需要更改应该改那个文件，不要修改这个文件！
export const components = [
${components.map(name => `  '${name}',`).join('\n')}
]
`
}

async function fetchComponentHtml() {
  const { data } = await axios.get<string>(WECHAT_COMPONENTS_URL, {
    responseType: 'text',
    timeout: 30_000,
  })
  return data
}

/** 获取文档并完成全部校验后，才允许写入生成文件。 */
export async function updateBuiltinComponents(options: {
  previousComponents: readonly string[]
  writeSource: (source: string) => Promise<void>
  fetchHtml?: () => Promise<string>
  log?: (message: string) => void
}) {
  const log = options.log ?? console.log
  log(`[wechat-builtins] fetching ${WECHAT_COMPONENTS_URL}`)
  const html = await (options.fetchHtml ?? fetchComponentHtml)()
  const names = extractBuiltinComponents(html)
  const previous = new Set(options.previousComponents)
  const current = new Set([...FIXED_TAGS, ...names])
  const added = names.filter(name => !previous.has(name))
  const missing = options.previousComponents.filter(name => !current.has(name))
  log(`[wechat-builtins] extracted ${names.length} components; added: ${added.join(', ') || '(none)'}; missing: ${missing.join(', ') || '(none)'}`)
  const components = validateBuiltinComponents(names, options.previousComponents)
  await options.writeSource(renderBuiltinComponents(components))
  log(`[wechat-builtins] wrote ${components.length} tags`)
  return components
}
