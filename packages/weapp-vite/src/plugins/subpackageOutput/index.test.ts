import type { OutputChunk, RolldownOutput } from 'rolldown'
import type { Plugin, UserConfig } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import { createSubpackageOutputPlugin } from './index'
import { expandSubpackageTemplate } from './template'

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'subpackage-output-'))
  try {
    await mkdir(path.join(root, 'src/packages/feature'), { recursive: true })
    await writeFile(path.join(root, 'src/main.js'), 'export const load = () => import("./packages/feature/lazy.js")')
    await writeFile(path.join(root, 'src/packages/feature/lazy.js'), 'import "./style.css"; import image from "./image.svg"; export const value = image')
    await writeFile(path.join(root, 'src/packages/feature/style.css'), '.feature { background: url("./image.svg"); color: red; }')
    await writeFile(path.join(root, 'src/packages/feature/image.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h8v8H0z"/></svg>')
    await run(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function compile(root: string, options: NonNullable<UserConfig['build']> = {}, extraPlugins: Plugin[] = []) {
  return await build({
    configFile: false,
    root,
    base: './',
    logLevel: 'silent',
    plugins: [createSubpackageOutputPlugin({ srcRoot: path.join(root, 'src'), roots: () => ['packages/feature', 'packages/other'] }), ...extraPlugins],
    build: {
      assetsInlineLimit: 0,
      minify: false,
      ...options,
      rolldownOptions: {
        input: path.join(root, 'src/main.js'),
        preserveEntrySignatures: 'strict',
        ...options.rolldownOptions,
      },
    },
  }) as RolldownOutput
}

describe('subpackage naming through Vite', () => {
  it('uses assetsDir for chunks, CSS and URLs without leaking placeholders', async () => {
    await fixture(async (root) => {
      const result = await compile(root, { assetsDir: '[subpackage]/assets' })
      const names = result.output.map(item => item.fileName)
      expect(names.some(name => /^assets\/main-.*\.js$/.test(name))).toBe(true)
      expect(names.some(name => /^packages\/feature\/assets\/lazy-.*\.js$/.test(name))).toBe(true)
      expect(names.some(name => /^packages\/feature\/assets\/lazy-.*\.css$/.test(name))).toBe(true)
      expect(names.some(name => /^packages\/feature\/assets\/image-.*\.svg$/.test(name))).toBe(true)
      for (const item of result.output) {
        const content = await readFile(path.join(root, 'dist', item.fileName), 'utf8')
        expect(content).not.toContain('[subpackage]')
      }
      const chunks = result.output.filter((item): item is OutputChunk => item.type === 'chunk')
      const css = result.output.find(item => item.type === 'asset' && item.fileName.endsWith('.css'))!
      const cssContent = await readFile(path.join(root, 'dist', css.fileName), 'utf8')
      const image = cssContent.match(/url\(["']?([^"')]+)["']?\)/)![1]!
      expect(names).toContain(path.normalize(path.join(path.dirname(css.fileName), image)))
      for (const chunk of chunks) {
        for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) {
          expect(names).toContain(dependency)
        }
      }
    })
  })

  it.each([false, true])('preserves explicit chunkFileNames priority, function=%s', async (callback) => {
    await fixture(async (root) => {
      const template = '[subpackage]/chunks/[name]-[hash].js'
      const result = await compile(root, {
        assetsDir: '[subpackage]/assets',
        rolldownOptions: { output: { chunkFileNames: callback ? () => template : template } },
      })
      const names = result.output.map(item => item.fileName)
      expect(names.some(name => /^packages\/feature\/chunks\/lazy-.*\.js$/.test(name))).toBe(true)
      expect(names.some(name => /^packages\/feature\/assets\/image-.*\.svg$/.test(name))).toBe(true)
    })
  })

  it('keeps templates without placeholders unchanged', async () => {
    await fixture(async (root) => {
      const result = await compile(root, {
        assetsDir: '[subpackage]/assets',
        rolldownOptions: { output: { chunkFileNames: 'ordinary/[name]-[hash].js' } },
      })
      expect(result.output.some(item => /^ordinary\/lazy-.*\.js$/.test(item.fileName))).toBe(true)
    })
  })

  it('does not resolve ownership for function templates that return ordinary paths', async () => {
    await fixture(async (root) => {
      const result = await compile(root, {
        assetsDir: 'assets',
        rolldownOptions: { output: { assetFileNames: () => 'ordinary/[name]-[hash][extname]' } },
      })
      expect(result.output.some(item => item.fileName.startsWith('ordinary/image-') && item.fileName.endsWith('.svg'))).toBe(true)
    })
  })

  it('leaves public files and explicit resource paths unchanged', async () => {
    await fixture(async (root) => {
      await mkdir(path.join(root, 'public'))
      await writeFile(path.join(root, 'public/keep.txt'), 'public-content')
      const result = await compile(root, {
        assetsDir: '[subpackage]/assets',
        rolldownOptions: { output: { assetFileNames: 'custom/[name]-[hash][extname]' } },
      })
      expect(result.output.some(item => /^custom\/image-.*\.svg$/.test(item.fileName))).toBe(true)
      expect(await readFile(path.join(root, 'dist/keep.txt'), 'utf8')).toBe('public-content')
    })
  })

  it('handles aggregate CSS and emits fonts with the owning package', async () => {
    await fixture(async (root) => {
      await writeFile(path.join(root, 'src/packages/feature/font.woff2'), 'font-resource')
      await writeFile(path.join(root, 'src/packages/feature/style.css'), '@font-face { font-family: feature; src: url("./font.woff2"); } .feature { color: red; }')
      const result = await compile(root, { assetsDir: '[subpackage]/assets', cssCodeSplit: false })
      expect(result.output.some(item => /^packages\/feature\/assets\/font-.*\.woff2$/.test(item.fileName))).toBe(true)
      expect(result.output.some(item => item.fileName.endsWith('.css'))).toBe(true)
      expect(result.output.every(item => !item.fileName.includes('[subpackage]'))).toBe(true)
    })
  })

  it('keeps one shared resource when different packages emit identical content', async () => {
    await fixture(async (root) => {
      await mkdir(path.join(root, 'src/packages/other'))
      await writeFile(path.join(root, 'src/packages/other/image.svg'), await readFile(path.join(root, 'src/packages/feature/image.svg')))
      await writeFile(path.join(root, 'src/packages/other/lazy.js'), 'import image from "./image.svg"; export const value = image')
      await writeFile(path.join(root, 'src/main.js'), 'export const load = () => import("./packages/feature/lazy.js"); export const other = () => import("./packages/other/lazy.js")')
      const result = await compile(root, { assetsDir: '[subpackage]/assets' })
      const images = result.output.filter(item => item.fileName.endsWith('.svg'))
      expect(images).toHaveLength(1)
      // 原生内容去重选择其中一个命名候选，不在输出阶段搬移或再发射。
      expect(images[0]!.fileName).toMatch(/^packages\/(feature|other)\/assets\/image-.*\.svg$/)
      const css = result.output.find(item => item.fileName.endsWith('.css'))!
      const content = await readFile(path.join(root, 'dist', css.fileName), 'utf8')
      const url = content.match(/url\(["']?([^"')]+)["']?\)/)![1]!
      expect(path.normalize(path.join(path.dirname(css.fileName), url))).toBe(images[0]!.fileName)
    })
  })

  it('diagnoses missing plugin asset provenance only when the template needs it', async () => {
    await fixture(async (root) => {
      const emitter: Plugin = {
        name: 'missing-provenance',
        buildStart() {
          this.emitFile({ type: 'asset', name: 'unknown.txt', source: 'unknown' })
        },
      }
      await expect(compile(root, { assetsDir: '[subpackage]/assets' }, [emitter])).rejects.toThrow('originalFileNames')
      await expect(compile(root, { assetsDir: 'assets' }, [emitter])).resolves.toBeDefined()
    })
  })
})

describe('subpackage directory templates', () => {
  it('preserves native placeholders and removes the main package segment', () => {
    expect(expandSubpackageTemplate('[subpackage]/chunks/[name]-[hash].js', () => '')).toBe('chunks/[name]-[hash].js')
    expect(expandSubpackageTemplate('[subpackage]\\assets\\[name].js', () => 'packages/feature')).toBe('packages/feature/assets/[name].js')
  })
  it.each(['[subpackage]/../[name].js', '/[subpackage]/[name].js', '[subpackage]/[subpackage]/[name].js', 'x[subpackage]/[name].js'])('rejects malformed templates: %s', (template) => {
    expect(() => expandSubpackageTemplate(template, () => 'packages/feature')).toThrow('[subpackage]')
  })
  it('does not resolve ownership when the template opts out', () => {
    expect(expandSubpackageTemplate('assets/[name].js', () => {
      throw new Error('unused')
    })).toBe('assets/[name].js')
  })
})
