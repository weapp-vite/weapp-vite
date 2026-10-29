import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createLogger } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../src/plugin'
import { RUNTIME_ID } from '../src/plugin/constants'

describe('unknown tag plugin diagnostics', () => {
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
      expect(warn.mock.calls.filter(([message]) => String(message).includes('未知标签'))).toEqual([
        [expect.stringContaining('<buton>')],
      ])
      expect(warn.mock.calls.some(([message]) => String(message).includes('weapp-navigation-bar'))).toBe(false)
      expect(warn.mock.calls.some(([message]) => String(message).includes('<path>'))).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('retains generated template exports during a production build with diagnostics', async () => {
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
      expect(warn.mock.calls.some(([message]) => message.includes('未知标签') && message.includes('<buton>'))).toBe(true)
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
      const logger = createLogger('silent')
      const warn = vi.spyOn(logger, 'warn')
      await build({
        root,
        configFile: false,
        customLogger: logger,
        plugins: [weappWebPlugin({ srcDir: 'src', __runtimeProvider: { moduleId: RUNTIME_ID } })],
        build: {
          write: false,
          lib: {
            entry: { home: join(pageDir, mode === 'page' ? 'index.js' : 'index.wxml'), ...(shared ? { other: join(pageDir, 'other.wxml') } : {}) },
            formats: ['es'],
          },
          rolldownOptions: { external: ['lit', 'lit/directives/repeat.js', RUNTIME_ID] },
        },
      })
      const warnings = warn.mock.calls.map(([message]) => message).filter(message => message.includes('未知标签'))
      expect(warnings.filter(message => message.includes('<buton>'))).toHaveLength(shared ? 2 : 1)
      expect(warnings.filter(message => message.includes('<order-card>'))).toHaveLength(1)
      expect(warnings.filter(message => message.includes('<my-card>'))).toHaveLength(shared ? 1 : 0)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
