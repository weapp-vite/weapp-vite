import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createTailwindController, createTailwindPreparation } from './controller'
import { prepareTailwindOutput } from './output'

const require = createRequire(import.meta.url)

it.each(['weapp', 'alipay', 'toutiao'] as const)('keeps old %s snapshots valid while replacing and deleting candidates', async (platform) => {
  const root = await mkdtemp(path.join(tmpdir(), 'shared-tailwind-'))
  const controller = createTailwindController({ compiler: { appType: 'weapp-vite', platform, tailwindcssBasedir: root } })
  try {
    await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'tailwindcss'), 'junction')
    const compiler = await controller.getCompiler()
    const entry = path.join(root, 'app.css')
    const css = `@import ${JSON.stringify(path.join(root, 'tailwindcss/index.css'))};`
    await writeFile(entry, css)
    const options = { id: 'app', target: 'weapp' as const, sourceOptions: { projectRoot: root, cssEntries: [entry] }, scanSources: false }
    const before = await compiler.generate({ ...options, sources: [{ content: '<view class="py-5.5 p-4" />', extension: 'html' }] })
    const pinned = createTailwindPreparation(compiler, before.snapshot)
    const after = await compiler.generate({ ...options, sources: [{ content: '<view class="px-3.5 p-4" />', extension: 'html' }] })
    expect(before.snapshot.classSet.has('py-5.5')).toBe(true)
    expect(after.snapshot.classSet.has('py-5.5')).toBe(false)
    expect(after.snapshot.classSet.has('p-4')).toBe(true)
    expect(after.snapshot.classSet.has('px-3.5')).toBe(true)
    const transformed = await pinned.transformJavaScript!({ code: 'const props = {className: "py-5.5"}', fileName: 'page.js' })
    expect(transformed?.code).toContain('py-5_d5')
    expect(transformed?.map).toBeTruthy()
    const current = createTailwindPreparation(compiler, after.snapshot)
    expect((await current.transformJavaScript!({ code: 'const props = {className: "px-3.5"}', fileName: 'page.js' }))?.code).toContain('px-3_d5')
    const nativeCss = await compiler.transformCss(after.rawCss, after.snapshot)
    expect(nativeCss.css).toContain('.px-3_d5')
    expect(nativeCss.css).not.toContain('.py-5_d5')
  }
  finally {
    await controller.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

it('does not create a compiler when invalidating or disposing an unused controller', async () => {
  let loads = 0
  const controller = createTailwindController({ loadCore: async () => {
    loads++
    throw new Error('must remain dormant')
  } })
  expect(await controller.invalidate(['unused.css'])).toEqual([])
  await controller.remove('unused')
  await controller.dispose()
  expect(loads).toBe(0)
  await expect(controller.getCompiler()).rejects.toThrow('disposed')
})

it('captures CSS and class identity before asynchronous compiler initialization', async () => {
  const controller = createTailwindController()
  const classSet = new Set(['py-5.5'])
  const input = { id: 'external-projection', css: '.py-5\\.5 { padding: 22px }', classSet }
  const pending = prepareTailwindOutput(controller.getCompiler(), input)
  input.css = '.changed { color: red }'
  classSet.clear()
  try {
    const prepared = await pending
    expect(prepared.css).toContain('.py-5_d5')
    expect(prepared.css).not.toContain('.changed')
    expect(prepared.snapshot.classSet.has('py-5.5')).toBe(true)
    expect((await prepared.preparation.transformJavaScript!({ code: 'const className = "py-5.5"', fileName: 'page.js' }))?.code).toContain('py-5_d5')
  }
  finally {
    await controller.dispose()
  }
})
