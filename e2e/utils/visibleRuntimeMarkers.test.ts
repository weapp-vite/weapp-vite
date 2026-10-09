import { describe, expect, it, vi } from 'vitest'
import { matchesVisibleRuntimeMarkers, readVisibleRuntimeMarkers } from './visibleRuntimeMarkers'

const route = 'pages/index/index'
const selectors = ['.page', '.label', '.bootstrap']
const markers = [
  { dataKey: 'label', selector: '.label', text: 'updated label' },
  { dataKey: 'bootstrap', selector: '.bootstrap', text: 'bootstrap ready' },
]

function createPage() {
  const texts: Record<string, string> = {
    '.page': 'updated label bootstrap ready',
    '.label': 'updated label',
    '.bootstrap': 'bootstrap ready',
  }
  const page = {
    path: route,
    data: vi.fn(async () => ({ label: 'updated label', bootstrap: 'bootstrap ready' })),
    $: vi.fn(async (selector: string) => ({
      text: async () => texts[selector]!,
      size: async () => ({ width: 100, height: 20 }),
    })),
  }
  return { page, texts }
}

describe('visible runtime markers', () => {
  it('uses direct page data and target node text without reading the page-stack facade', async () => {
    const { page } = createPage()
    const snapshot = await readVisibleRuntimeMarkers(page, selectors)
    expect(matchesVisibleRuntimeMarkers(snapshot, route, markers)).toBe(true)
    expect(page.data).toHaveBeenCalledExactlyOnceWith(undefined, { fallback: false, timeout: 2_500 })
    expect(page.$.mock.calls.map(([selector]) => selector)).toEqual(selectors)
    for (const selector of selectors) {
      expect(page.$).toHaveBeenCalledWith(selector, { fallback: false, timeout: 2_500 })
    }
  })

  it.each(['old label', 'prefix updated label suffix', 'bootstrap ready'])('rejects wrong target text even when page data and another node contain the marker: %s', async (label) => {
    const { page, texts } = createPage()
    texts['.label'] = label
    expect(matchesVisibleRuntimeMarkers(await readVisibleRuntimeMarkers(page, selectors), route, markers)).toBe(false)
  })

  it('rejects stale page protocol data even when the rendered target text is current', async () => {
    const { page } = createPage()
    page.data.mockResolvedValue({ label: 'old label', bootstrap: 'bootstrap ready' })
    expect(matchesVisibleRuntimeMarkers(await readVisibleRuntimeMarkers(page, selectors), route, markers)).toBe(false)
  })

  it('requires the expected route and visibility of every original selector', async () => {
    const { page } = createPage()
    const snapshot = await readVisibleRuntimeMarkers(page, selectors)
    expect(matchesVisibleRuntimeMarkers({ ...snapshot, route: 'pages/other/index' }, route, markers)).toBe(false)
    snapshot.elements[0]!.width = 0
    expect(matchesVisibleRuntimeMarkers(snapshot, route, markers)).toBe(false)
  })

  it('keeps a failed direct protocol read as a failure', async () => {
    const { page } = createPage()
    const error = new Error('Page.getData unavailable')
    page.data.mockRejectedValue(error)
    await expect(readVisibleRuntimeMarkers(page, selectors)).rejects.toBe(error)
  })
})
