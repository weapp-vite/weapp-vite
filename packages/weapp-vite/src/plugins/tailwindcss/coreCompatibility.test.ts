import type { Compiler, CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, postcss } from 'weapp-tailwindcss/core'

const require = createRequire(import.meta.url)
const tailwindDirectory = path.dirname(require.resolve('tailwindcss/package.json'))
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) {
    await dispose()
  }
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-tailwind-core-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'node_modules'), { recursive: true })
  await symlink(tailwindDirectory, path.join(root, 'node_modules/tailwindcss'), 'junction')
  const compiler = createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root })
  cleanup.push(() => compiler.dispose())
  const entry = path.join(root, 'app.css')
  const request: CompilerGenerateRequest = {
    id: 'weapp-vite:tailwindcss:compatibility',
    sourceOptions: { projectRoot: root, cssEntries: [entry], packageName: 'tailwindcss' },
    target: 'weapp',
    scanSources: true,
  }
  return { root, compiler, entry, request }
}

function cssDeclarations(css: string, property: string) {
  const declarations: string[] = []
  postcss.parse(css).walkDecls(property, (declaration) => {
    declarations.push(declaration.value)
  })
  return declarations
}

async function assertTransforms(compiler: Compiler, request: CompilerGenerateRequest, candidate: string, width: string) {
  const generated = await compiler.generate(request)
  expect(generated.classSet.has(candidate)).toBe(true)
  expect(cssDeclarations(generated.css, 'width')).toContain(width)
  const snapshot = compiler.mergeSnapshots([generated.snapshot])
  const template = await compiler.transformTemplate(`<view class="${candidate}" />`, snapshot, { filename: 'pages/index/index.wxml' })
  const transformedClass = /class="([^"]+)"/.exec(template)?.[1]
  expect(transformedClass).toBeDefined()
  expect(transformedClass).not.toContain('[')
  const js = await compiler.transformJavaScript(`const className = '${candidate}'; const label = 'unknown-[business]';`, snapshot)
  expect(js.error).toBeUndefined()
  expect(js.code).toContain(transformedClass)
  expect(js.code).toContain('unknown-[business]')
  let renderedRule = false
  postcss.parse(generated.css).walkRules(`.${transformedClass}`, (rule) => {
    rule.walkDecls('width', (declaration) => {
      renderedRule ||= declaration.value === width
    })
  })
  expect(renderedRule).toBe(true)
  return generated
}

describe('published Tailwind Core compatibility', () => {
  it('decodes escaped source paths before scanning utilities', async () => {
    const { root, compiler, entry, request } = await fixture()
    const sourceDirectory = path.join(root, 'source pages')
    await mkdir(sourceDirectory)
    await writeFile(path.join(sourceDirectory, 'index.wxml'), '<view class="w-[37px] p-2" />')
    await writeFile(path.join(root, 'outside.wxml'), '<view class="w-[99px]" />')
    await writeFile(entry, '@import "tailwindcss" source("./source\\20 pages");')

    const generated = await assertTransforms(compiler, request, 'w-[37px]', '37px')
    expect(generated.classSet.has('p-2')).toBe(true)
    expect(generated.classSet.has('w-[99px]')).toBe(false)
    expect(cssDeclarations(generated.css, 'padding').length).toBeGreaterThan(0)
  })

  it('invalidates deleted and restored sources through their symlink path', async () => {
    const { root, compiler, entry, request } = await fixture()
    const sourceDirectory = path.join(root, 'actual-pages')
    const linkedDirectory = path.join(root, 'linked-pages')
    await mkdir(sourceDirectory)
    await symlink(sourceDirectory, linkedDirectory, 'junction')
    const source = path.join(sourceDirectory, 'index.wxml')
    const linkedSource = path.join(linkedDirectory, 'index.wxml')
    await writeFile(entry, '@import "tailwindcss" source("./linked-pages");')
    await writeFile(source, '<view class="w-[37px]" />')
    const initial = await assertTransforms(compiler, request, 'w-[37px]', '37px')

    await rm(source)
    expect(compiler.invalidate([linkedSource])).toContain(request.id)
    const removed = await compiler.generate(request)
    expect(removed.classSet.has('w-[37px]')).toBe(false)
    expect(cssDeclarations(removed.css, 'width')).not.toContain('37px')

    await writeFile(source, '<view class="w-[53px]" />')
    expect(compiler.invalidate([linkedSource])).toContain(request.id)
    const restored = await assertTransforms(compiler, request, 'w-[53px]', '53px')
    expect(restored.classSet.has('w-[37px]')).toBe(false)
    expect(initial.snapshot.classSet.has('w-[37px]')).toBe(true)
    expect(initial.snapshot.classSet.has('w-[53px]')).toBe(false)
  })
})
