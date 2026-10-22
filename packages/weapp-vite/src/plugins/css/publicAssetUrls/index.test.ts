import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'
import { restoreCompiledPublicAssetUrls } from './index'

const roots: string[] = []
const failure = 'public 资源 URL 无法与本轮预处理结果精确对应'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-public-style-urls-'))
  roots.push(root)
  const publicDir = path.join(root, 'public')
  await mkdir(path.join(publicDir, 'images'), { recursive: true })
  for (const name of ['first.svg', 'second.svg', 'font.woff2', 'space icon.svg', 'encoded%2Fpart%3Fname%23.svg']) {
    await writeFile(path.join(publicDir, 'images', name), name)
  }
  const sourceId = path.join(root, 'src', 'page.scss')
  return {
    root,
    publicDir,
    restore: (compiled: string, processed: string) => restoreCompiledPublicAssetUrls(compiled, processed, sourceId, publicDir),
  }
}

it('restores only public slots while preserving compiled inline and native emitted URLs byte for byte', async () => {
  const { restore } = await fixture()
  const data = 'data:image/svg+xml,%3Csvg%20viewBox=%220%200%201%201%22%3E%3C/svg%3E'
  const compiled = `.page {\n  background: url(__VITE_PUBLIC_ASSET__first__), url('${data}'), url("./assets/native.svg"), url('__VITE_PUBLIC_ASSET__second__');\n}\n`
  const processed = '.page{background:url("/images/first.svg?raw=%23#mask"),url("./inline.svg"),url("./regular.svg"),url(/images/second.svg)}'
  expect(await restore(compiled, processed)).toBe(compiled
    .replace('__VITE_PUBLIC_ASSET__first__', '"/images/first.svg?raw=%23#mask"')
    .replace('\'__VITE_PUBLIC_ASSET__second__\'', '/images/second.svg'))
})

it('treats image-set direct strings and uppercase data URLs as leaves without interpreting data content', async () => {
  const { restore } = await fixture()
  const data = 'data:image/svg+xml,%3Csvg%3E,%3C/svg%3E'
  const compiled = `.page{background:IMAGE-SET("__VITE_PUBLIC_ASSET__first__" 1x,URL(${data}) 2x,type("image/svg+xml"));mask:-webkit-image-set('__VITE_PUBLIC_ASSET__second__' 1x)}`
  const processed = '.page{background:IMAGE-SET("/images/first.svg" 1x,URL(./inline.svg) 2x,type("image/svg+xml"));mask:-webkit-image-set("/images/second.svg?theme=dark#icon" 1x)}'
  expect(await restore(compiled, processed)).toBe(compiled
    .replace('"__VITE_PUBLIC_ASSET__first__"', '"/images/first.svg"')
    .replace('\'__VITE_PUBLIC_ASSET__second__\'', '"/images/second.svg?theme=dark#icon"'))
})

it('preserves compiled comments, whitespace and data bytes inside values and at-rule parameters', async () => {
  const { restore } = await fixture()
  const compiled = '@supports (background: /*before*/ url(__VITE_PUBLIC_ASSET__supports__) /*after*/) {\n.page { background: url(data:image/svg+xml,%3Csvg%3E,%3C/svg%3E) /*keep*/ , url(__VITE_PUBLIC_ASSET__first__) /*tail*/ ; }\n}\n'
  const processed = '@supports (background:url(/images/second.svg)){.page{background:url(./inline.svg),url("/images/first.svg")}}'
  expect(await restore(compiled, processed)).toBe(compiled
    .replace('__VITE_PUBLIC_ASSET__supports__', '/images/second.svg')
    .replace('__VITE_PUBLIC_ASSET__first__', '"/images/first.svg"'))
})

it('restores font-face, custom properties, at-rule URLs and import strings with their original suffixes', async () => {
  const { restore } = await fixture()
  const compiled = '@import "__VITE_PUBLIC_ASSET__import__" screen;@font-face{src:url(__VITE_PUBLIC_ASSET__font__) format("woff2")}@supports (background:url(__VITE_PUBLIC_ASSET__supports__)){.page{--image:url(__VITE_PUBLIC_ASSET__custom__) !important}}'
  const processed = '@import "/images/first.svg?import#sheet" screen;@font-face{src:url("/images/font.woff2?v=1#font") format("woff2")}@supports (background:url(/images/second.svg)){.page{--image:url(/images/first.svg?custom) !important}}'
  expect(await restore(compiled, processed)).toBe(processed)
})

it('preserves CSS escapes and encoded reserved path characters without decoding the emitted CSS', async () => {
  const { restore } = await fixture()
  const compiled = '.page{background:url(__VITE_PUBLIC_ASSET__space__),url(__VITE_PUBLIC_ASSET__encoded__)}'
  const processed = String.raw`.page{background:url('/images/space\20 icon.svg?q=%23#mask'),url("/images/encoded%2Fpart%3Fname%23.svg?variant=2#icon")}`
  expect(await restore(compiled, processed)).toBe(processed)
})

it('allows repeated opaque tokens only when every occurrence identifies the same public URL', async () => {
  const { restore } = await fixture()
  const compiled = '.page{background:url(__VITE_PUBLIC_ASSET__same__),url("__VITE_PUBLIC_ASSET__same__")}'
  const consistent = '.page{background:url(/images/space%20icon.svg),url("/images/space icon.svg")}'
  expect(await restore(compiled, consistent)).toBe(consistent)
  const conflicting = '.page{background:url(/images/first.svg),url(/images/second.svg)}'
  await expect(restore(compiled, conflicting)).rejects.toThrow(failure)
  await expect(restore(compiled, consistent.replace('space icon.svg', 'space icon.svg?different'))).rejects.toThrow(failure)
})

it.each([
  ['rule selector', '.other{background:url(/images/first.svg)}'],
  ['property', '.page{mask:url(/images/first.svg)}'],
  ['important', '.page{background:url(/images/first.svg)!important}'],
  ['URL count', '.page{background:url(/images/first.svg),url(/images/second.svg)}'],
  ['function structure', '.page{background:image-set("/images/first.svg" 1x)}'],
  ['extra declaration', '.page{background:url(/images/first.svg);color:red}'],
  ['missing declaration', '.page{}'],
  ['rule order', '.before{} .page{background:url(/images/first.svg)}'],
])('rejects an unproven mapping after a %s change', async (_reason, processed) => {
  const { restore } = await fixture()
  await expect(restore('.page{background:url(__VITE_PUBLIC_ASSET__first__)}', processed)).rejects.toThrow(failure)
})

it('rejects changed non-URL values and at-rule structure rather than returning uncompiled CSS', async () => {
  const { restore } = await fixture()
  const compiled = '@media screen{.page{background:url(__VITE_PUBLIC_ASSET__first__);color:red}}'
  await expect(restore(compiled, '@media screen{.page{background:url(/images/first.svg);color:blue}}')).rejects.toThrow(failure)
  await expect(restore(compiled, '@media print{.page{background:url(/images/first.svg);color:red}}')).rejects.toThrow(failure)
  await expect(restore('.page{background:url(__VITE_PUBLIC_ASSET__missing)}', '.page{background:url(/images/first.svg)}')).rejects.toThrow(failure)
  await expect(restore('.page{background:url(__VITE_PUBLIC_ASSET__first__)}', '.page{background:url("/images/first.svg)}')).rejects.toThrow(failure)
})

it.each([
  '/images/missing.svg',
  './images/first.svg',
  '//cdn.example/images/first.svg',
  'https://cdn.example/images/first.svg',
  'data:image/svg+xml,example',
  '/../outside.svg',
  '/%2e%2e/outside.svg',
  '/images',
  '/images/%GG.svg',
])('rejects a public placeholder whose corresponding URL cannot identify a public file: %s', async (url) => {
  const { restore } = await fixture()
  await expect(restore('.page{background:url(__VITE_PUBLIC_ASSET__first__)}', `.page{background:url("${url}")}`)).rejects.toThrow(failure)
})

it('requires publicDir and preserves the original cause when restoration is impossible', async () => {
  const { root } = await fixture()
  const result = restoreCompiledPublicAssetUrls('.page{background:url(__VITE_PUBLIC_ASSET__first__)}', '.page{background:url(/images/first.svg)}', path.join(root, 'page.scss'), false)
  await expect(result).rejects.toMatchObject({ message: expect.stringContaining(failure), cause: expect.objectContaining({ message: 'publicDir 不可用' }) })
})

it.skipIf(process.platform === 'win32')('accepts a public symlink file without requiring the target to live in publicDir', async () => {
  const { root, publicDir, restore } = await fixture()
  const target = path.join(root, 'linked.svg')
  await writeFile(target, '<svg/>')
  await symlink(target, path.join(publicDir, 'images', 'linked.svg'))
  const processed = '.page{background:url(/images/linked.svg)}'
  expect(await restore('.page{background:url(__VITE_PUBLIC_ASSET__linked__)}', processed)).toBe(processed)
})

it('returns compiled CSS untouched when no public marker requires restoration', async () => {
  const compiled = '.page { background: url("data:image/svg+xml,%3Csvg%3E"); }\n'
  expect(await restoreCompiledPublicAssetUrls(compiled, 'not the compiled stylesheet', 'page.scss', false)).toBe(compiled)
})
