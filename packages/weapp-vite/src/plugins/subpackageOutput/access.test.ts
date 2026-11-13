import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import { expect, it } from 'vitest'
import { assertBundleAssetAccess } from './access'

const context = { srcRoot: 'src', roots: () => ['packages/feature', 'packages/other'] }
function asset(fileName: string, source = ''): OutputAsset {
  return { type: 'asset', fileName, source, names: [], originalFileNames: [] }
}
function chunk(fileName: string, importedAssets: string[], imports: string[] = []): OutputChunk {
  return { type: 'chunk', fileName, imports, viteMetadata: { importedAssets: new Set(importedAssets) } } as OutputChunk
}
function bundle(...outputs: Array<OutputAsset | OutputChunk>): OutputBundle {
  return Object.fromEntries(outputs.map(output => [output.fileName, output]))
}

it('rejects sibling consumers, including static chunk cycles, while allowing main resources', () => {
  const image = asset('packages/feature/assets/image.png')
  const shared = chunk('packages/feature/shared.js', [image.fileName], ['packages/other/page.js'])
  const page = chunk('packages/other/page.js', [], [shared.fileName])
  expect(() => assertBundleAssetAccess(bundle(image, shared, page), context, '/')).toThrow('packages/other/page.js')
  const main = asset('assets/image.png')
  expect(() => assertBundleAssetAccess(bundle(main, chunk(page.fileName, [main.fileName])), context, '/')).not.toThrow()
})

it.each([
  'url("../packages/feature/assets/icon%20one.png?v=1#mask")',
  'URL("/base/packages/feature/assets/icon%20one.png")',
  'image-set("/base/packages/feature/assets/icon%20one.png" 1x)',
])('checks final CSS consumers with encoded references: %s', (reference) => {
  const css = asset('assets/all.css', `.page { background: ${reference} }`)
  const image = asset('packages/feature/assets/icon one.png')
  expect(() => assertBundleAssetAccess(bundle(css, image), context, '/base/')).toThrow('跨分包资源')
})

it('checks stylesheet imports but ignores comments, ordinary strings and external URLs', () => {
  const css = asset('assets/all.css', '@import "/packages/feature/theme.css";')
  expect(() => assertBundleAssetAccess(bundle(css, asset('packages/feature/theme.css')), context, '/')).toThrow('跨分包资源')
  css.source = '/* url(/packages/feature/theme.css) */ .a{content:"/packages/feature/theme.css";background:url(https://example.com/a.png),url(data:image/png;base64,abc)}'
  expect(() => assertBundleAssetAccess(bundle(css, asset('packages/feature/theme.css')), context, '/')).not.toThrow()
})

it('keeps independent consumers inside their package and uses no cross-build cache', () => {
  const image = asset('assets/image.png')
  const page = chunk('packages/feature/page.js', [image.fileName])
  expect(() => assertBundleAssetAccess(bundle(image, page), { ...context, independentRoot: 'packages/feature' }, '/')).toThrow('独立分包')
  expect(() => assertBundleAssetAccess(bundle(image, page), context, '/')).not.toThrow()
})
