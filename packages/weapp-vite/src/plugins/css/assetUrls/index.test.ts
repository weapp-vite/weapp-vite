import type { OutputAsset, OutputBundle } from 'rolldown'
import os from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { resolveNativeStyleAssetUrls } from './index'

const root = path.join(os.tmpdir(), 'weapp-style-asset-urls')
const sourceId = path.join(root, 'src/styles/main.scss')
const fileName = 'pages/detail/index.wxss'

function bundle(...assets: Array<[string, string[]]>): OutputBundle {
  return Object.fromEntries(assets.map(([fileName, originalFileNames]) => [fileName, {
    type: 'asset',
    fileName,
    originalFileNames,
    names: originalFileNames.map(original => path.basename(original)),
    source: '',
  } as OutputAsset]))
}

it('uses exact native source ownership for a local URL next to public, data and external URLs', () => {
  const assets = bundle(['assets/icon-emitted.svg', ['src/images/icon.svg']])
  const source = '.page { background: url("../images/icon.svg?raw=%23#mask"), url("/images/public.svg"), url(data:image/png;base64,AAAA), url(https://cdn.example/icon.svg); }'
  expect(resolveNativeStyleAssetUrls(source, sourceId, fileName, assets, root)).toBe(source.replace('../images/icon.svg', '../../assets/icon-emitted.svg'))
})

it('decodes escaped and encoded filenames without changing suffixes or emitting unsafe URL characters', () => {
  const assets = bundle(['assets/icon #out(2).svg', ['src/images/icon #name(2).svg']])
  const encoded = '.page{background:url("../images/icon%20%23name%282%29.svg?v=%23#mask")} '
  expect(resolveNativeStyleAssetUrls(encoded, sourceId, fileName, assets, root)).toBe('.page{background:url("../../assets/icon%20%23out%282%29.svg?v=%23#mask")} ')
  const escaped = String.raw`.page{background:url('../images/icon\ \#name\(2\).svg?v=1#mask')}`
  expect(resolveNativeStyleAssetUrls(escaped, sourceId, fileName, assets, root)).toBe('.page{background:url(\'../../assets/icon%20%23out%282%29.svg?v=1#mask\')}')
})

it('handles uppercase URL and image-set strings while retaining ordinary strings and stylesheet imports', () => {
  const assets = bundle(['assets/icon-emitted.svg', ['src/images/icon.svg']])
  const source = '@import url("../images/icon.svg"); .page{content:"../images/icon.svg";background:IMAGE-SET("../images/icon.svg" 1x, URL(../images/icon.svg) 2x, type("image/svg+xml"))}'
  const expected = '@import url("../images/icon.svg"); .page{content:"../images/icon.svg";background:IMAGE-SET("../../assets/icon-emitted.svg" 1x, URL(../../assets/icon-emitted.svg) 2x, type("image/svg+xml"))}'
  expect(resolveNativeStyleAssetUrls(source, sourceId, fileName, assets, root)).toBe(expected)
})

it('keeps unknown, malformed and ambiguous references intact without basename matching', () => {
  const assets = bundle(
    ['assets/first.svg', ['src/images/icon.svg']],
    ['assets/second.svg', ['src/images/icon.svg']],
    ['assets/known.svg', ['src/other/unknown.svg']],
  )
  const source = '.page{background:url(../images/icon.svg),url(../images/unknown.svg),url(../images/icon%GG.svg),url(//cdn.example/icon.svg),url(#paint),url(?query)}'
  expect(resolveNativeStyleAssetUrls(source, sourceId, fileName, assets, root)).toBe(source)
})

it('isolates native output mappings and accepts deduplicated assets with multiple exact source files', () => {
  const first = bundle(['assets/first.svg', ['src/images/icon.svg', path.join(root, 'src/images/copy.svg')]])
  const second = bundle(['assets/second.svg', ['src/images/icon.svg']])
  const source = '.page{background:url(../images/icon.svg),url(../images/copy.svg)}'
  expect(resolveNativeStyleAssetUrls(source, sourceId, fileName, first, root)).toBe('.page{background:url(../../assets/first.svg),url(../../assets/first.svg)}')
  expect(resolveNativeStyleAssetUrls(source, sourceId, fileName, second, root)).toBe('.page{background:url(../../assets/second.svg),url(../images/copy.svg)}')
})
