import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { TailwindRootState } from './roots'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { prepareTailwindRoots } from './roots'

it.each([
  { name: 'explicit @source', directives: '@source "./pages/**/*.ts"; @source not "./pages/ignored.ts";', automatic: false },
  { name: 'explicit content config', directives: '@config "../tailwind.config.js";', automatic: false },
  { name: 'automatic sources', directives: '', automatic: true },
])('uses the final raw scan plan for $name across script-only and utility changes', async ({ directives, automatic }) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'tailwind-root-scope-')))
  const compilerOptions = { tailwindcssBasedir: root, appType: 'weapp-vite' as const, rem2rpx: true }
  const compiler = createCompiler(compilerOptions)
  const reference = createCompiler(compilerOptions)
  try {
    await mkdir(path.join(root, 'src/pages'), { recursive: true })
    await mkdir(path.join(root, 'node_modules'))
    await symlink(path.dirname(createRequire(import.meta.url).resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    const entry = path.join(root, 'src/tailwind.css')
    const source = path.join(root, 'src/pages/index.ts')
    const outside = path.join(root, 'src/app.js')
    const ignored = path.join(root, 'src/pages/ignored.ts')
    const css = `@import "tailwindcss"; ${directives}`
    const initialSource = 'export const utility = "w-[37px] text-[24rpx]";'
    await writeFile(entry, css)
    await writeFile(source, initialSource)
    await writeFile(outside, 'export const outside = "w-[91px] bg-[blue]";')
    await writeFile(ignored, 'export const ignored = "w-[73px]";')
    await writeFile(path.join(root, 'tailwind.config.js'), 'export default { content: ["./src/pages/**/*.ts", "!./src/pages/ignored.ts"] }')
    const request: CompilerGenerateRequest = {
      id: 'scope-root',
      sourceOptions: { projectRoot: root, cssEntries: [entry] },
      scanSources: true,
      incrementalCache: false,
      target: 'weapp',
    }
    const initial = await compiler.generate(request)
    expect(initial.classSet.has('w-[37px]')).toBe(true)
    expect(initial.classSet.has('w-[91px]')).toBe(automatic)
    expect(initial.classSet.has('w-[73px]')).toBe(automatic)
    const sources = new Map<string, string>()
    for (const file of [...initial.dependencies, source, outside, ignored]) {
      sources.set(file, await readFile(file, 'utf8'))
    }
    const state: TailwindRootState = { request, result: initial, rawSources: new Map([[entry, css]]) }
    for (const [index, nextSource] of [
      `${initialSource}\nconsole.log("script-only");`,
      initialSource.replace('37px', '53px'),
    ].entries()) {
      await writeFile(source, nextSource)
      sources.set(source, nextSource)
      const expected = await reference.generate({ ...request, id: `disk-scope-${index}` })
      const prepared = await prepareTailwindRoots(compiler, {
        revision: index + 1,
        changedFiles: [source],
        sources,
      }, new Map([['root', state]]), { cwd: root, sourceId: file => file })
      const actual = prepared.get('root')!
      expect(actual.rawCss).toBe(expected.rawCss)
      expect(actual.css).toBe(expected.css)
      expect([...actual.classSet].sort()).toEqual([...expected.classSet].sort())
      expect(actual.classSet.has('w-[91px]')).toBe(automatic)
      expect(actual.classSet.has('w-[73px]')).toBe(automatic)
      if (index === 0) {
        expect(actual.rawCss).toBe(initial.rawCss)
        expect(actual.css).toBe(initial.css)
      }
      else {
        expect(actual.classSet.has('w-[53px]')).toBe(true)
        expect(actual.classSet.has('w-[37px]')).toBe(false)
      }
    }
  }
  finally {
    await Promise.all([compiler.dispose(), reference.dispose()])
    await rm(root, { recursive: true, force: true })
  }
})
