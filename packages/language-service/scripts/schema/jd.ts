import type { SchemaSource } from './sources.ts'
import { parse, traverse } from '@weapp-vite/ast'
import { attributesFromMarkdown } from './markdown.ts'

interface Navigation {
  id: number
  content?: string
  children?: Navigation[]
  articles?: { id: number, title: string }[]
}

/** 仅提取公开文档客户端声明的频道元数据，不保存或输出该值。 */
export function extractJdPublicChannel(source: string): string {
  const candidates = new Set<string>()
  traverse(parse(source, { sourceType: 'unambiguous' }), {
    ObjectProperty(path) {
      const value = path.node.value
      if (value.type !== 'FunctionExpression' || value.start == null || value.end == null) {
        return
      }
      const body = source.slice(value.start, value.end)
      if (!body.includes('documentChannelToken') || !body.includes('/api/openapi/front/articleNavigation/tree')) {
        return
      }
      path.traverse({
        AssignmentExpression(assignment) {
          const { left, right } = assignment.node
          if (left.type !== 'MemberExpression' || !((left.property.type === 'Identifier' && left.property.name === 'documentChannelToken') || (left.property.type === 'StringLiteral' && left.property.value === 'documentChannelToken')) || right.type !== 'Identifier') {
            return
          }
          const binding = assignment.scope.getBinding(right.name)
          for (const violation of binding?.constantViolations ?? []) {
            if (violation.node.type !== 'AssignmentExpression' || violation.node.right.type !== 'Identifier') {
              continue
            }
            const declaration = violation.scope.getBinding(violation.node.right.name)?.path.node
            if (declaration?.type === 'VariableDeclarator' && declaration.init?.type === 'StringLiteral') {
              candidates.add(declaration.init.value)
            }
          }
        },
      })
    },
  })
  if (candidates.size !== 1) {
    throw new Error('京东文档公开频道元数据不唯一，拒绝猜测')
  }
  return [...candidates][0]
}

function flatten(nodes: Navigation[]): Navigation[] {
  return nodes.flatMap(node => [node, ...flatten(node.children ?? [])])
}

/** 京东组件内容取自当前文档站声明的公开 API，保留平台自己的 Markdown 属性表。 */
export async function jdSources(download: (url: string) => Promise<string>): Promise<SchemaSource[]> {
  const origin = 'https://mp-docs.jd.com'
  const home = await download(`${origin}/doc/miniapp/dev/component/-1`)
  const manifestPath = home.match(/src="([^"]+\/_buildManifest\.js)"/)?.[1]
  if (!manifestPath) {
    throw new Error('京东文档缺少公开构建清单')
  }
  const manifest = await download(new URL(manifestPath, origin).href)
  const chunks = [...new Set([...manifest.matchAll(/"(static\/chunks\/\d+-\w+\.js)"/g)].map(match => `${origin}/_next/${match[1]}`))]
  let channel: string | undefined
  for (let offset = 0; offset < chunks.length && !channel; offset += 4) {
    const bodies = await Promise.all(chunks.slice(offset, offset + 4).map(download))
    const client = bodies.find(body => body.includes('documentChannelToken') && body.includes('/api/openapi/front/articleNavigation/tree'))
    if (client) {
      channel = extractJdPublicChannel(client)
    }
  }
  if (!channel) {
    throw new Error('京东文档公开客户端中未找到组件接口')
  }
  const headers = { 'documentChannelToken': channel, 'X-isInternal': '0' }
  async function api<T>(endpoint: string): Promise<T> {
    const response = await fetch(`https://miniapp-doc.jd.com/api/openapi/front/${endpoint}`, { headers, signal: AbortSignal.timeout(30_000) })
    const result = await response.json() as { status?: number, data?: T }
    if (!response.ok || result.status !== 200 || result.data === undefined) {
      throw new Error(`京东公开文档接口失败：${endpoint.split('?')[0]}`)
    }
    return result.data
  }
  const navigation = flatten(await api<Navigation[]>('articleNavigation/tree')).find(node => node.content === '/component')
  if (!navigation) {
    throw new Error('京东文档没有小程序组件导航')
  }
  const categories = flatten(await api<Navigation[]>(`articleCategory/tree?navigationId=${navigation.id}`))
  return categories.flatMap(category => (category.articles ?? []).flatMap((article) => {
    const name = article.title.trim()
    if (!/^[a-z][\w-]*$/.test(name)) {
      return []
    }
    const url = `${origin}/doc/miniapp/dev/component/${article.id}`
    return [{ name, url, load: async () => {
      const detail = await api<{ detail?: string, title?: string }>(`article/detail?id=${article.id}`)
      if (typeof detail.detail !== 'string' || !detail.detail.trim()) {
        throw new Error(`京东组件 ${name} 没有文档内容`)
      }
      return { component: { name, docLink: url, attrs: attributesFromMarkdown(detail.detail) }, versionInput: detail.detail }
    } }]
  }))
}
