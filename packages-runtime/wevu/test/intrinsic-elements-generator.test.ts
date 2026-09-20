import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface ComponentCatalogEntry {
  attrs?: Array<{ name: string, jsxName?: string }>
  name: string
}

const COMMON_TAGS = [
  'button',
  'camera',
  'canvas',
  'checkbox',
  'checkbox-group',
  'form',
  'icon',
  'image',
  'input',
  'label',
  'map',
  'match-media',
  'movable-area',
  'movable-view',
  'navigator',
  'picker',
  'picker-view',
  'picker-view-column',
  'progress',
  'radio',
  'radio-group',
  'rich-text',
  'scroll-view',
  'slider',
  'swiper',
  'swiper-item',
  'switch',
  'text',
  'textarea',
  'video',
  'view',
  'web-view',
] as const

const packageRoot = path.resolve(import.meta.dirname, '..')
const catalogPaths = [
  'components.weapp.json',
  'components.alipay.json',
  'components.tt.json',
]

async function readCatalog(fileName: string): Promise<ComponentCatalogEntry[]> {
  const content = await readFile(path.resolve(packageRoot, fileName), 'utf8')
  return JSON.parse(content) as ComponentCatalogEntry[]
}

describe('intrinsic element generator', () => {
  it('keeps committed declarations synchronized with validated catalogs', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-intrinsic-elements.mjs', '--check'], {
      cwd: packageRoot,
      encoding: 'utf8',
    })

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it('derives the exact three-platform tag intersection', async () => {
    const catalogs = await Promise.all(catalogPaths.map(readCatalog))
    const platformTagSets = catalogs.map(catalog => new Set(catalog.map(component => component.name)))
    const commonTags = [...platformTagSets[0]]
      .filter(tag => platformTagSets.slice(1).every(platformTags => platformTags.has(tag)))
      .sort()

    expect(commonTags).toEqual([...COMMON_TAGS].sort())
  })

  it('emits compiler-source event names without host markup aliases', async () => {
    const buttonPath = path.resolve(packageRoot, 'src/weappIntrinsicElements/elements/button.ts')
    const mapPath = path.resolve(packageRoot, 'src/weappIntrinsicElements.ts')
    const scrollViewPath = path.resolve(packageRoot, 'src/weappIntrinsicElements/elements/scroll-view.ts')
    const commonScrollViewPath = path.resolve(packageRoot, 'src/miniprogramIntrinsicElements/elements/scroll-view.ts')
    const [button, map, scrollView, commonScrollView] = await Promise.all([
      readFile(buttonPath, 'utf8'),
      readFile(mapPath, 'utf8'),
      readFile(scrollViewPath, 'utf8'),
      readFile(commonScrollViewPath, 'utf8'),
    ])

    expect(button).toContain('onGetRealtimePhoneNumber?: WevuJsxEventHandler')
    expect(scrollView).toContain('onScrollToUpper?: WevuJsxEventHandler')
    expect(scrollView).not.toContain('onWorklet')
    expect(commonScrollView).toContain('onScrollToUpper?: WevuJsxEventHandler')
    expect(button).not.toMatch(/\bbind[a-z]/)
    expect(map).not.toMatch(/\b(?:div|span|img|a):/)
    expect(map).not.toContain('[name: string]')
  })
})
