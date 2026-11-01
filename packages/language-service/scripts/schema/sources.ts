import type { ComponentEntry } from '../../src/schema/types.ts'
import { setTimeout } from 'node:timers/promises'
import { attributesFromCompiledDocs } from './compiled.ts'
import { attributesFromHtml, attributesFromRows, extractStaticObject, textContent } from './html.ts'
import { attributesFromTuyaSchema } from './tuya.ts'

interface MenuNode {
  directory_id?: string
  directory_name?: string
  link?: string
  text?: string
  children?: MenuNode[]
  sidebar?: MenuNode[]
}

export interface SchemaSource {
  name: string
  url: string
  load: () => Promise<{ component: ComponentEntry, versionInput: string }>
}

/** 文档下载失败时终止同步，不把缺页写成空的成功资产。 */
export async function download(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (response.ok) {
      return response.text()
    }
    if (response.status < 500 || attempt === 2) {
      throw new Error(`文档下载失败 (${response.status}): ${url}`)
    }
    await setTimeout((attempt + 1) * 500)
  }
  throw new Error(`文档下载失败：${url}`)
}

function walk(value: unknown, visit: (node: MenuNode) => void) {
  if (!value || typeof value !== 'object') {
    return
  }
  if (!Array.isArray(value)) {
    visit(value as MenuNode)
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      walk(child, visit)
    }
  }
}

/** 使用百度官方导航及结构化文档接口，不从微信表派生组件属性。 */
export async function baiduSources(): Promise<SchemaSource[]> {
  const nav = JSON.parse(await download('https://devforum.cdn.bcebos.com/mbdma/docs_file/nav.json')) as unknown
  const sources: SchemaSource[] = []
  walk(nav, (node) => {
    const name = node.text?.split(' ')[0]
    if (!node.link?.startsWith('/develop/component/') || !name || !/^[a-z][\w-]*$/.test(name) || ['component', 'native'].includes(name)) {
      return
    }
    const url = `https://smartprogram.baidu.com/docs${node.link}/`
    const link = node.link
    sources.push({ name, url, load: async () => {
      const body = await download(`https://smartprogram.baidu.com/forum/api/docs_detail?path=${encodeURIComponent(link)}&preview=0`)
      const result = JSON.parse(body) as { errno?: number, data?: { content?: { explaintion?: string, params?: { tableList?: { tableContent?: { header?: string[], cells?: string[][] } }[] }[] } } }
      if (result.errno !== 0 || !result.data?.content) {
        throw new Error(`百度文档没有有效内容：${url}`)
      }
      const content = result.data.content
      const attrs = (content.params ?? []).flatMap(section => (section.tableList ?? []).flatMap(table => attributesFromRows([table.tableContent?.header ?? [], ...table.tableContent?.cells ?? []])))
      return { component: { name, docLink: url, attrs, ...(content.explaintion ? { desc: [content.explaintion] } : {}) }, versionInput: body }
    } })
  })
  return [...new Map(sources.map(source => [source.name, source])).values()]
}

/** 小红书组件目录来自官方页面的静态状态，仅抓取“组件”目录中的组件文档。 */
export async function xhsSources(): Promise<SchemaSource[]> {
  const page = await download('https://miniapp.xiaohongshu.com/doc/DC563786')
  const rawState = page.match(/window\.__INITIAL_STATE__=([\s\S]*?)<\/script>/)?.[1]
  if (!rawState) {
    throw new Error('小红书文档缺少静态组件目录')
  }
  const state = extractStaticObject(rawState, 'rootTree')
  const catalogs: MenuNode[] = []
  walk(state, (node) => {
    if (node.directory_name === '组件') {
      catalogs.push(node)
    }
  })
  const sources: SchemaSource[] = []
  walk(catalogs, (node) => {
    const name = node.directory_name
    if (name && node.directory_id && /^[a-z][a-z0-9-]*$/.test(name)) {
      const url = `https://miniapp.xiaohongshu.com/doc/${node.directory_id}`
      sources.push({ name, url, load: async () => {
        const body = await download(url)
        return { component: { name, docLink: url, attrs: attributesFromHtml(body) }, versionInput: body }
      } })
    }
  })
  if (!sources.length) {
    throw new Error('小红书组件目录为空，拒绝覆盖已有资产')
  }
  return [...new Map(sources.map(source => [source.name, source])).values()]
}

/** 快手目录从官方文档站的公开路由表读取，页面内容仍从对应文档 URL 获取。 */
export async function kuaishouSources(): Promise<SchemaSource[]> {
  const home = await download('https://mp.kuaishou.com/docs/')
  const app = home.match(/src="([^"]+\/app\.[^"]+\.js)"/)?.[1]
  if (!app) {
    throw new Error('快手文档缺少公开路由资产')
  }
  const routes = await download(app.startsWith('//') ? `https:${app}` : app)
  const paths = [...new Set([...routes.matchAll(/path:"(\/develop\/components\/[^"]+)"/g)].map(match => match[1]))]
  return paths.flatMap((path) => {
    const name = path.split('/').at(-1)?.replace(/\.html$/, '')
    if (!name || !/^[a-z][\w-]*$/.test(name) || /native-components|^index$/.test(name)) {
      return []
    }
    const url = `https://mp.kuaishou.com/docs${path}`
    return [{ name, url, load: async () => {
      const body = await download(`${url}?language-schema=${new Date().toISOString().slice(0, 10)}`)
      if (!/<html\b/i.test(body) || /404|页面走丢了/.test(body.slice(0, 1500))) {
        throw new Error(`快手组件文档无效：${url}`)
      }
      return { component: { name, docLink: url, attrs: attributesFromHtml(body) }, versionInput: body }
    } }]
  })
}

/** 涂鸦文档通过页面声明的构建清单定位组件；静态解析 JSX，避免运行页面代码。 */
export async function tuyaSources(): Promise<SchemaSource[]> {
  const home = await download('https://developer.tuya.com/cn/miniapp/develop/miniapp/framework/tyml')
  const manifestUrl = home.match(/src="([^"]+\/_buildManifest\.js)"/)?.[1]
  if (!manifestUrl) {
    throw new Error('涂鸦文档缺少公开构建清单')
  }
  const manifest = await download(manifestUrl)
  const schemaBody = await download('https://images.tuyacn.com/smart/doc/schemas/mothra-framework.json')
  const schema = attributesFromTuyaSchema(JSON.parse(schemaBody) as unknown)
  const route = /"(\/cn\/miniapp\/develop\/miniapp\/component\/[^"]+)":\[([^\]]+)\]/g
  const sources: SchemaSource[] = []
  for (const match of manifest.matchAll(route)) {
    const name = match[1].split('/').at(-1)!
    const chunk = match[2].match(/"([^"]*pages\/[^"]+\.js)"/)?.[1]
    if (!chunk || !/^[a-z][\w-]*$/.test(name)) {
      continue
    }
    const url = `https://developer.tuya.com${match[1]}`
    const chunkUrl = `${manifestUrl.slice(0, manifestUrl.indexOf('/_next/'))}/_next/${chunk}`
    sources.push({ name, url, load: async () => {
      const component = schema.get(name)
      if (component) {
        return { component: { name, docLink: url, ...component }, versionInput: schemaBody }
      }
      const body = await download(chunkUrl)
      return { component: { name, docLink: url, attrs: attributesFromCompiledDocs(body).attributes }, versionInput: body }
    } })
  }
  return [...new Map(sources.map(source => [source.name, source])).values()]
}

/** QQ 多个组件可能共用一个页面；以官方组件标题选择对应章节。 */
export async function qqSources(): Promise<SchemaSource[]> {
  const home = await download('https://q.qq.com/wiki/develop/miniprogram/component/')
  const sources: SchemaSource[] = []
  for (const anchor of home.matchAll(/<a[^>]+href="([^"]+component[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const name = textContent(anchor[2])
    if (!/^[a-z][\w-]*$/.test(name) || name === 'movable') {
      continue
    }
    const url = new URL(anchor[1], 'https://q.qq.com').href
    sources.push({ name, url, load: async () => {
      const body = await download(url)
      const heading = new RegExp(`<h([1-6])[^>]+id="${name}"[^>]*>`, 'i').exec(body)
      let section = body
      if (heading) {
        const start = heading.index
        const tail = body.slice(start + heading[0].length)
        const end = new RegExp(`<h[1-${heading[1]}]\\b`, 'i').exec(tail)?.index
        section = body.slice(start, end === undefined ? undefined : start + heading[0].length + end)
      }
      return { component: { name, docLink: url, attrs: attributesFromHtml(section) }, versionInput: body }
    } })
  }
  return [...new Map(sources.map(source => [source.name, source])).values()]
}
