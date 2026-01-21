import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'weapp-web-'))
  const srcRoot = join(root, 'src')
  return { root, srcRoot }
}

function resolveTemplate(srcRoot: string, raw: string, importer: string) {
  if (raw.startsWith('/')) {
    return join(srcRoot, raw.slice(1))
  }
  return resolve(dirname(importer), raw)
}

describe('compileWxml recursive dependencies', () => {
  it('collects nested import/include dependencies', async () => {
    const { srcRoot } = await createFixture()
    const pageDir = join(srcRoot, 'pages/index')
    const partsDir = join(pageDir, 'parts')
    const sharedDir = join(srcRoot, 'pages/shared')
    await mkdir(partsDir, { recursive: true })
    await mkdir(sharedDir, { recursive: true })

    const entry = join(pageDir, 'index.wxml')
    const card = join(partsDir, 'card.wxml')
    const footer = join(sharedDir, 'footer.wxml')

    await writeFile(entry, `<import src="./parts/card.wxml" /><view>ok</view>`)
    await writeFile(card, `<include src="../../shared/footer.wxml" /><view>card</view>`)
    await writeFile(footer, `<view>footer</view>`)

    const source = await readFile(entry, 'utf8')
    const result = compileWxml({
      id: entry,
      source,
      resolveTemplatePath: (raw, importer) => resolveTemplate(srcRoot, raw, importer),
      resolveWxsPath: () => undefined,
    })

    expect(result.dependencies).toHaveLength(2)
    expect(result.dependencies).toEqual(expect.arrayContaining([card, footer]))
  })

  it('warns when dependency file is missing', async () => {
    const { srcRoot } = await createFixture()
    const pageDir = join(srcRoot, 'pages/index')
    await mkdir(pageDir, { recursive: true })

    const entry = join(pageDir, 'index.wxml')
    await writeFile(entry, `<include src="./missing.wxml" />`)

    const source = await readFile(entry, 'utf8')
    const result = compileWxml({
      id: entry,
      source,
      resolveTemplatePath: (raw, importer) => resolveTemplate(srcRoot, raw, importer),
      resolveWxsPath: () => undefined,
    })

    expect(result.warnings?.some(warning => warning.includes('无法读取模板依赖'))).toBe(true)
  })

  it('warns on circular dependencies', async () => {
    const { srcRoot } = await createFixture()
    const pageDir = join(srcRoot, 'pages/index')
    const partsDir = join(pageDir, 'parts')
    await mkdir(partsDir, { recursive: true })

    const entry = join(pageDir, 'index.wxml')
    const card = join(partsDir, 'card.wxml')

    await writeFile(entry, `<include src="./parts/card.wxml" />`)
    await writeFile(card, `<include src="../index.wxml" />`)

    const source = await readFile(entry, 'utf8')
    const result = compileWxml({
      id: entry,
      source,
      resolveTemplatePath: (raw, importer) => resolveTemplate(srcRoot, raw, importer),
      resolveWxsPath: () => undefined,
    })

    expect(result.warnings?.some(warning => warning.includes('循环'))).toBe(true)
  })
})
