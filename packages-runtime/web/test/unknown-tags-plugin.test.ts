import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createLogger } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../src/plugin'
import { RUNTIME_ID, SFC_TEMPLATE_QUERY, TEMPLATE_QUERY } from '../src/plugin/constants'

describe('unknown tag plugin diagnostics', () => {
  it.each(['off', 'warn', 'error'] as const)('obeys %s and replaces diagnostics after a source is corrected', async (level) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'web-tag-options-')))
    try {
      const pageDir = join(root, 'src/pages/home')
      await mkdir(pageDir, { recursive: true })
      await writeFile(join(root, 'src/app.js'), 'App({})')
      await writeFile(join(root, 'src/app.json'), '{"pages":["pages/home/index"]}')
      await writeFile(join(pageDir, 'index.js'), 'Page({})')
      await writeFile(join(pageDir, 'index.json'), '{}')
      const filename = join(pageDir, 'index.wxml')
      const source = '<view>\n  <buton /><web-view />\n</view>'
      await writeFile(filename, source)
      const logger = createLogger('silent')
      const error = vi.spyOn(logger, 'error')
      const warn = vi.fn()
      const context = { warn, error: () => {
        throw new Error('diagnostic must not fail the build')
      } }
      const plugin = weappWebPlugin({ srcDir: 'src', runtime: { warnings: { level } } })
      await plugin.configResolved!.call(context, { root, command: 'serve', logger })
      await plugin.transform!.call(context, source, filename)
      await plugin.load!.call(context, `${filename}?weapp-web-template`)
      const calls = () => level === 'error' ? error.mock.calls : warn.mock.calls
      expect(calls()).toHaveLength(level === 'off' ? 0 : 2)
      if (level !== 'off') {
        expect(calls().some(([message]) => message.includes('index.wxml:2:3') && message.includes('<buton>'))).toBe(true)
        expect(calls().some(([message]) => message.includes('Web 端未实现') && message.includes('<web-view>'))).toBe(true)
      }
      await plugin.transform!.call(context, '<view />', filename)
      await plugin.transform!.call(context, source, filename)
      expect(calls()).toHaveLength(level === 'off' ? 0 : 4)
      expect(level === 'error' ? warn.mock.calls : error.mock.calls).toEqual([])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['serve', 'build'] as const)('reports user tags through the existing %s warning channel', async (command) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'web-tag-plugin-')))
    try {
      const pageDir = join(root, 'src/pages/home')
      await mkdir(pageDir, { recursive: true })
      await writeFile(join(root, 'src/app.js'), 'App({})')
      await writeFile(join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/home/index'] }))
      await writeFile(join(pageDir, 'index.js'), 'Page({})')
      await writeFile(join(pageDir, 'index.json'), '{}')
      const source = '<view><svg><path /></svg><buton /><buton /></view>'
      await writeFile(join(pageDir, 'index.wxml'), source)
      const plugin = weappWebPlugin({ srcDir: 'src' })
      const warn = vi.fn()
      const context = { warn, addWatchFile: vi.fn() }
      if (typeof plugin.configResolved !== 'function' || typeof plugin.transform !== 'function') {
        throw new TypeError('Missing Web plugin hooks')
      }
      await plugin.configResolved.call(context as never, { root, command } as never)
      const result = await plugin.transform.call(context as never, source, join(pageDir, 'index.wxml'))
      expect(result).toBeTruthy()
      expect(warn.mock.calls.filter(([message]) => String(message).includes('未知标签'))).toEqual(command === 'serve'
        ? [
            [expect.stringContaining('<buton>')],
          ]
        : [])
      expect(warn.mock.calls.some(([message]) => String(message).includes('weapp-navigation-bar'))).toBe(false)
      expect(warn.mock.calls.some(([message]) => String(message).includes('<path>'))).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('retains generated template exports during a silent production build', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'web-tag-build-')))
    try {
      const pageDir = join(root, 'src/pages/home')
      await mkdir(pageDir, { recursive: true })
      await writeFile(join(root, 'src/app.js'), 'App({})')
      await writeFile(join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/home/index'] }))
      await writeFile(join(pageDir, 'index.js'), 'Page({})')
      await writeFile(join(pageDir, 'index.json'), '{}')
      const entry = join(pageDir, 'index.wxml')
      await writeFile(entry, '<view><buton>content remains</buton></view>')
      const logger = createLogger('silent')
      const warn = vi.spyOn(logger, 'warn')
      const result = await build({
        root,
        configFile: false,
        customLogger: logger,
        plugins: [weappWebPlugin({ srcDir: 'src', __runtimeProvider: { moduleId: RUNTIME_ID } })],
        build: {
          write: false,
          lib: { entry, formats: ['es'], fileName: 'template' },
          rolldownOptions: { external: ['lit', 'lit/directives/repeat.js', RUNTIME_ID] },
        },
      })
      if ('on' in result) {
        throw new TypeError('Unexpected watch build')
      }
      const outputs = Array.isArray(result) ? result : [result]
      const chunks = outputs.flatMap(output => output.output).filter(output => output.type === 'chunk')
      expect(chunks.some(chunk => chunk.exports.includes('render'))).toBe(true)
      expect(chunks.some(chunk => chunk.code.includes('content remains'))).toBe(true)
      expect(warn.mock.calls.some(([message]) => message.includes('未知标签') && message.includes('<buton>'))).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['template', 'page', 'shared'] as const)('owns dependency diagnostics in each parent registration scope (%s)', async (mode) => {
    const shared = mode === 'shared'
    const root = await realpath(await mkdtemp(join(tmpdir(), 'web-tag-scope-')))
    try {
      const pageDir = join(root, 'src/pages/home')
      const componentDir = join(root, 'src/components/card')
      await mkdir(pageDir, { recursive: true })
      await mkdir(componentDir, { recursive: true })
      await writeFile(join(root, 'src/app.js'), 'App({})')
      await writeFile(join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/home/index', ...(shared ? ['pages/home/other'] : [])] }))
      await writeFile(join(componentDir, 'index.js'), 'Component({})')
      await writeFile(join(componentDir, 'index.json'), '{"component":true}')
      await writeFile(join(componentDir, 'index.wxml'), '<view>card</view>')
      await writeFile(join(pageDir, 'index.js'), 'Page({})')
      await writeFile(join(pageDir, 'index.json'), '{"usingComponents":{"my-card":"../../components/card/index"}}')
      await writeFile(join(pageDir, 'index.wxml'), '<include src="./part.wxml" /><import src="./templates.wxml" /><template is="card" />')
      await writeFile(join(pageDir, 'part.wxml'), '<buton /><my-card />')
      await writeFile(join(pageDir, 'templates.wxml'), '<template name="card"><order-card /><my-card /></template>')
      if (shared) {
        await writeFile(join(pageDir, 'other.js'), 'Page({})')
        await writeFile(join(pageDir, 'other.json'), '{}')
        await writeFile(join(pageDir, 'other.wxml'), '<include src="./part.wxml" />')
      }
      const plugin = weappWebPlugin({ srcDir: 'src' })
      const warn = vi.fn()
      const context = { warn }
      await plugin.configResolved!.call(context, { root, command: 'serve' })
      for (const name of shared ? ['index', 'other'] : ['index']) {
        const filename = join(pageDir, `${name}.wxml`)
        if (mode === 'page') {
          await plugin.load!.call(context, `${filename}?${TEMPLATE_QUERY}`)
        }
        else {
          await plugin.transform!.call(context, await readFile(filename, 'utf8'), filename)
        }
      }
      const warnings = warn.mock.calls.map(([message]) => message).filter(message => message.includes('未知标签'))
      expect(warnings.filter(message => message.includes('<buton>'))).toHaveLength(shared ? 2 : 1)
      expect(warnings.filter(message => message.includes('<order-card>'))).toHaveLength(1)
      expect(warnings.filter(message => message.includes('<my-card>'))).toHaveLength(shared ? 1 : 0)
      expect(warnings.some(message => message.includes('part.wxml:1:1'))).toBe(true)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each([false, true])('uses original SFC %s template sources without warning on resolved PascalCase components', async (external) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'web-tag-sfc-')))
    try {
      const pageDir = join(root, 'src/pages/home')
      await mkdir(pageDir, { recursive: true })
      await mkdir(join(root, 'src/components'), { recursive: true })
      await writeFile(join(root, 'src/app.js'), 'App({})')
      await writeFile(join(root, 'src/app.json'), '{"pages":["pages/home/index"]}')
      await writeFile(join(root, 'src/components/card.vue'), '<template><view>card</view></template>')
      const filename = join(pageDir, 'index.vue')
      const template = '\n  <MyCard /><buton /><web-view /><svg><foreignObject /></svg>\n<include src="./part.wxml" /><import src="./templates.wxml" /><template is="card" />\n'
      const part = join(pageDir, 'part.wxml')
      await writeFile(part, '<view>\n  <my-card /><included-typo />\n</view>')
      await writeFile(join(pageDir, 'templates.wxml'), '<template name="card">\n  <imported-typo /><my-card />\n</template>')
      await writeFile(join(pageDir, 'part.html'), template)
      await writeFile(filename, `<script setup>import MyCard from '../../components/card.vue'</script>\n${external ? '<template src="./part.html" />' : `<template>${template}</template>`}`)
      const plugin = weappWebPlugin({ srcDir: 'src' })
      const warn = vi.fn()
      const context = { warn }
      await plugin.configResolved!.call(context, { root, command: 'serve' })
      await plugin.load!.call(context, `${filename}?${SFC_TEMPLATE_QUERY}`)
      const messages = warn.mock.calls.map(([message]) => String(message))
      expect(messages.filter(message => message.includes('<buton>'))).toEqual([
        expect.stringContaining(external ? 'part.html:2:13' : 'index.vue:3:13'),
      ])
      expect(messages.filter(message => message.includes('<web-view>'))).toHaveLength(1)
      expect(messages.some(message => message.includes('<MyCard>') || message.includes('<my-card>'))).toBe(false)
      expect(messages.some(message => message.includes('foreignObject') || message.includes('foreign-object'))).toBe(false)
      expect(messages.filter(message => message.includes('<included-typo>'))).toEqual([
        expect.stringContaining('part.wxml:2:14'),
      ])
      expect(messages.filter(message => message.includes('<imported-typo>'))).toEqual([
        expect.stringContaining('templates.wxml:2:3'),
      ])
      await writeFile(part, '<view />')
      await plugin.load!.call(context, `${filename}?${SFC_TEMPLATE_QUERY}`)
      await writeFile(part, '\n\n<included-typo />')
      await plugin.load!.call(context, `${filename}?${SFC_TEMPLATE_QUERY}`)
      expect(warn.mock.calls.map(([message]) => String(message)).filter(message => message.includes('<included-typo>'))).toEqual([
        expect.stringContaining('part.wxml:2:14'),
        expect.stringContaining('part.wxml:3:1'),
      ])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
