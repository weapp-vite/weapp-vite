import { readFile } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'

/** 失败诊断只记录有界摘要，任何采集异常均不能替代原验收错误。 */
export async function captureHomeFailureDiagnostics(miniProgram: any, home: any, projectRoot: string | undefined) {
  const timeout = 2_500
  async function observe(read: () => Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return {
        status: 'fulfilled',
        value: await Promise.race([
          Promise.resolve().then(read),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              const error = new Error('DiagnosticTimeout')
              error.name = 'DiagnosticTimeout'
              reject(error)
            }, timeout)
          }),
        ]),
      }
    }
    catch (error) {
      return { status: 'rejected', error: error instanceof Error ? error.name : typeof error }
    }
    finally {
      clearTimeout(timer)
    }
  }

  async function summarizeNodes(nodes: any[]) {
    return {
      count: nodes.length,
      nodes: await Promise.all(nodes.slice(0, 8).map(async (node) => {
        const readAttribute = node.attribute ?? node.attr
        const attributes = Object.fromEntries(await Promise.all([
          'id',
          'class',
          'data-sim-component',
          'data-sim-scope',
        ].map(async name => [name, (await readAttribute?.call(node, name))?.slice(0, 200)])))
        const [scope, owner] = await Promise.all([
          node.componentScope?.(),
          node.ownerComponentScope?.(),
        ])
        return {
          tag: typeof node.tagName === 'function' ? await node.tagName() : node.tagName,
          attributes,
          scopeId: scope?.scopeId ?? null,
          ownerScopeId: owner?.scopeId ?? null,
        }
      })),
    }
  }

  const [state, goodsCount, component, bindings, scopeQueries] = await Promise.all([
    observe(async () => {
      const state = await home.data('__e2eHomeState', { fallback: false, timeout })
      return Object.fromEntries(['ready', 'goodsCount', 'loadStatus', 'pageLoading', 'tabCount', 'swiperCount']
        .map(key => [key, state?.[key]]))
    }),
    observe(async () => {
      const goods = await home.data('goodsList', { fallback: false, timeout })
      return Array.isArray(goods) ? goods.length : null
    }),
    observe(async () => await miniProgram.evaluateWithOptions(() => {
      const pages = getCurrentPages() as any[]
      const list = pages[pages.length - 1]?.selectComponent?.('goods-list')
      return list
        ? {
            found: true,
            id: list.id,
            listId: list.properties?.listId,
            independentID: list.data?.independentID,
            propertiesGoodsCount: Array.isArray(list.properties?.goodsList) ? list.properties.goodsList.length : null,
            dataGoodsCount: Array.isArray(list.data?.goodsList) ? list.data.goodsList.length : null,
          }
        : { found: false }
    }, { timeout })),
    observe(async () => {
      if (!projectRoot) {
        return null
      }
      const sources = await Promise.all(['pages/home/home.wxml', 'components/goods-list/index.wxml']
        .map(file => readFile(path.join(projectRoot!, 'dist', file), 'utf8')))
      return sources.flatMap(source => source.match(/<(?:goods-list|goods-card)\b[^>]*>/g) ?? [])
        .slice(0, 2)
        .map(tag => tag.slice(0, 800))
    }),
    observe(async () => {
      if (typeof home.snapshot !== 'function') {
        return { supported: false }
      }
      const startedAt = new Date().toISOString()
      const current = await miniProgram.currentPage({ appFunctionFallback: false })
      const identity = { expected: { pageId: home.pageId, path: home.path }, current: { pageId: current?.pageId, path: current?.path } }
      const components = await current.$$('component', { fallback: false, timeout })
      const matches = await Promise.all(components.slice(0, 64).map(async (node: any) => {
        const children = await node.$$('.goods-list-wrap', { timeout })
        return children.length ? node : null
      }))
      const parents = matches.filter(Boolean)
      return {
        startedAt,
        identity,
        componentCount: components.length,
        sampledComponentCount: Math.min(components.length, 64),
        parentCount: parents.length,
        truncated: components.length > 64 || parents.length > 2,
        parents: await Promise.all(parents.slice(0, 2).map(async (parent: any) => {
          const selectedAt = new Date().toISOString()
          // 三种查询复用已选父节点，不重新查询页面而触发另一次 headless 渲染。
          const [css, xpath, cards] = await Promise.all([
            parent.$$('#home-goods-list-gd-0', { timeout }),
            parent.getElementsByXpath?.('//*[@id="home-goods-list-gd-0"]', { fallback: false, timeout }),
            parent.getElementsByXpath?.('//*[contains(@data-sim-component, "goods-card") or contains(@id, "-gd-")]', { fallback: false, timeout }),
          ])
          return {
            selectedAt,
            queriedAt: new Date().toISOString(),
            parent: await summarizeNodes([parent]),
            css: await summarizeNodes(css),
            xpath: xpath ? await summarizeNodes(xpath) : null,
            cards: cards ? await summarizeNodes(cards) : null,
          }
        })),
      }
    }),
  ])
  process.stdout.write(`[retail-home-failure-diagnostics] ${JSON.stringify({ checkpoint: 'home-ready', state, goodsCount, component, bindings, scopeQueries })}\n`)
}
