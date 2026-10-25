interface RetailPageRootElement {
  tagName?: string | (() => Promise<string | undefined>)
  wxml: () => Promise<string>
  outerWxml?: () => Promise<string>
}

interface RetailPageRootQuery {
  getElementsByXpath: (selector: string, options: { fallback: false, timeout: number }) => Promise<RetailPageRootElement[]>
}

/** 读取当前页面全部并列渲染根，保留页面及独立 tabbar 的完整内容。 */
export async function queryRetailPageRoot(page: RetailPageRootQuery) {
  const roots = await page.getElementsByXpath('/*', { fallback: false, timeout: 2500 })
  if (roots.length === 0) {
    return null
  }
  return {
    async wxml() {
      const fragments: string[] = []
      for (const root of roots) {
        // 真实 IDE 的文档根是 #shadow-root，其 inner 包含全部并列子节点。
        // headless 的 wxml 本身返回完整 outer；真实普通元素须保留自身标签。
        const fragment = root.tagName === '#shadow-root' || !root.outerWxml
          ? await root.wxml()
          : await root.outerWxml()
        if (typeof fragment !== 'string') {
          throw new TypeError('Retail page root did not return complete WXML')
        }
        fragments.push(fragment)
      }
      return fragments.join('')
    },
  }
}
