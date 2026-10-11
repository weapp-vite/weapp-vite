import type { TailwindRootState } from './roots'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { prepareTailwindRoots } from './roots'

const require = createRequire(import.meta.url)

it.each([false, true])('filters captured inputs by the resolved CSS base (relative base: %s)', async (relative) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-root-base-')))
  const base = path.join(root, 'src')
  const compiler = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  try {
    await mkdir(base)
    await mkdir(path.join(root, 'node_modules'))
    await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    const entry = path.join(base, 'app.css')
    const source = path.join(base, 'page.html')
    const outside = path.join(root, 'outside.html')
    const css = '@import "tailwindcss/utilities"; @source "./*.html";'
    await writeFile(entry, css)
    await writeFile(source, '<view class="w-[37px]"/>')
    await writeFile(outside, '<view class="w-[91px]"/>')
    const request = {
      id: 'root',
      sourceOptions: { projectRoot: root, base: relative ? 'src' : base, cssEntries: [entry] },
      scanSources: true,
      target: 'weapp' as const,
    }
    const result = await compiler.generate(request)
    const sources = new Map<string, string>()
    for (const file of [...result.dependencies, source, outside]) {
      sources.set(file, await readFile(file, 'utf8'))
    }
    sources.set(source, '<view class="w-[53px]"/>')
    const state: TailwindRootState = { request, result, rawSources: new Map([[entry, css]]) }
    const prepared = await prepareTailwindRoots(compiler, { revision: 1, changedFiles: [source, outside], sources }, new Map([['root', state]]), {
      cwd: root,
      sourceId: file => file,
    })
    expect(prepared.get('root')?.css).toContain('53px')
    expect(prepared.get('root')?.css).not.toContain('37px')
    expect(prepared.get('root')?.css).not.toContain('91px')
    expect(request.sourceOptions.base).toBe(relative ? 'src' : base)
  }
  finally {
    await compiler.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
