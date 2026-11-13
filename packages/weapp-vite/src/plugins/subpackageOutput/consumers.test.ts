import type { RolldownOutput } from 'rolldown'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createSubpackageOutputPlugin } from './index'

it.each(['css', 'js'])('rejects another package consuming the same physical asset through %s', async (kind) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'subpackage-consumers-')))
  try {
    await mkdir(path.join(root, 'src/packages/feature'), { recursive: true })
    await writeFile(path.join(root, 'src/packages/feature/image.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h8v8H0z"/></svg>')
    await writeFile(path.join(root, 'src/main.js'), kind === 'css'
      ? 'import "./style.css"; export const load = () => import("./packages/feature/lazy.js")'
      : 'import image from "./packages/feature/image.svg"; export { image }; export const load = () => import("./packages/feature/lazy.js")')
    await writeFile(path.join(root, 'src/style.css'), '.main { background: url("./packages/feature/image.svg"); }')
    await writeFile(path.join(root, 'src/packages/feature/lazy.js'), 'import image from "./image.svg"; export { image }')
    const compile = (shared: boolean) => build({
      configFile: false,
      root,
      base: './',
      logLevel: 'silent',
      plugins: [createSubpackageOutputPlugin({ srcRoot: path.join(root, 'src'), roots: () => ['packages/feature'] })],
      build: {
        assetsDir: '[subpackage]/assets',
        assetsInlineLimit: 0,
        minify: false,
        rolldownOptions: {
          input: path.join(root, 'src/main.js'),
          preserveEntrySignatures: 'strict',
          output: shared ? { assetFileNames: 'assets/[name]-[hash][extname]' } : {},
        },
      },
    })
    await expect(compile(false)).rejects.toThrow('跨分包资源')
    const output = await compile(true) as RolldownOutput
    const image = output.output.find(item => item.fileName.endsWith('.svg'))!
    expect(image.fileName).toMatch(/^assets\//)
    if (kind === 'css') {
      const css = output.output.find(item => item.fileName.endsWith('.css'))!
      const content = await readFile(path.join(root, 'dist', css.fileName), 'utf8')
      const url = content.match(/url\(["']?([^"')]+)["']?\)/)![1]!
      expect(path.normalize(path.join(path.dirname(css.fileName), url))).toBe(image.fileName)
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
