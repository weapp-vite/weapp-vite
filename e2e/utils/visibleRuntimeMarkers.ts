interface RuntimeMarkerElement {
  size: () => Promise<{ width: number, height: number }>
  text: () => Promise<string>
}

interface RuntimeMarkerPage {
  path: string
  data: (path: undefined, options: { fallback: false, timeout: number }) => Promise<unknown>
  $: (selector: string, options: { fallback: false, timeout: number }) => Promise<RuntimeMarkerElement | null>
}

export interface RuntimeMarkerExpectation {
  dataKey: string
  selector: string
  text: string
}

export interface VisibleRuntimeMarkersSnapshot {
  route: string
  pageData: unknown
  elements: Array<{ selector: string, text: string | null, width: number, height: number }>
}

/** 从同一页面的原生协议读取数据和渲染文本，不依赖 getCurrentPages 包装对象的数据镜像。 */
export async function readVisibleRuntimeMarkers(
  page: RuntimeMarkerPage,
  selectors: readonly string[],
): Promise<VisibleRuntimeMarkersSnapshot> {
  const options = { fallback: false, timeout: 2_500 } as const
  const [pageData, elements] = await Promise.all([
    page.data(undefined, options),
    Promise.all(selectors.map(async (selector) => {
      const element = await page.$(selector, options)
      if (!element) {
        return { selector, text: null, width: 0, height: 0 }
      }
      const [text, size] = await Promise.all([element.text(), element.size()])
      return { selector, text: text.trim(), width: size.width, height: size.height }
    })),
  ])
  return { route: page.path, pageData, elements }
}

/** 数据字段、目标节点精确文本与可见性必须在同一次观察中全部满足。 */
export function matchesVisibleRuntimeMarkers(
  snapshot: VisibleRuntimeMarkersSnapshot,
  route: string,
  markers: readonly RuntimeMarkerExpectation[],
) {
  const data = snapshot.pageData
  return snapshot.route === route
    && data !== null
    && typeof data === 'object'
    && snapshot.elements.length > 0
    && snapshot.elements.every(element => element.width > 0 && element.height > 0)
    && markers.every(marker => (data as Record<string, unknown>)[marker.dataKey] === marker.text
      && snapshot.elements.some(element => element.selector === marker.selector && element.text === marker.text))
}
