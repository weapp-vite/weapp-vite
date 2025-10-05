import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { generate } from '@/schematics'

async function readFile(base: string, file: string) {
  return fs.readFile(path.join(base, file), 'utf8')
}

describe('schematics', () => {
  describe('generate', () => {
    const fixturesRoot = path.resolve(__dirname, './fixtures/schematics')

    it('creates default component files', async () => {
      const outputRoot = path.join(fixturesRoot, 'case0')
      await fs.emptyDir(outputRoot)

      await generate({
        outDir: 'case0',
        cwd: fixturesRoot,
      })

      await expect(readFile(outputRoot, 'case0.js')).resolves.toBe('Component({})')
      await expect(readFile(outputRoot, 'case0.wxss')).resolves.toBe('')
      await expect(readFile(outputRoot, 'case0.wxml')).resolves.toBe('<view>hello weapp-vite!</view>\n<view>from case0/case0</view>')

      const componentJson = await readFile(outputRoot, 'case0.json')
      expect(JSON.parse(componentJson)).toEqual({
        $schema: 'https://vite.icebreaker.top/component.json',
        component: true,
        styleIsolation: 'apply-shared',
        usingComponents: {},
      })
    })

    it('respects extension overrides', async () => {
      const outputRoot = path.join(fixturesRoot, 'case1')
      await fs.emptyDir(outputRoot)

      await generate({
        outDir: 'case1',
        cwd: fixturesRoot,
        extensions: {
          js: 'ts',
          json: 'ts',
          wxml: 'wxml',
          wxss: 'scss',
        },
      })

      await expect(readFile(outputRoot, 'case1.ts')).resolves.toBe('Component({})')
      await expect(readFile(outputRoot, 'case1.scss')).resolves.toBe('')
      await expect(readFile(outputRoot, 'case1.wxml')).resolves.toBe('<view>hello weapp-vite!</view>\n<view>from case1/case1</view>')
      await expect(readFile(outputRoot, 'case1.json.ts')).resolves.toContain('defineComponentJson({')
    })

    it('supports module style json output', async () => {
      const outputRoot = path.join(fixturesRoot, 'case2')
      await fs.emptyDir(outputRoot)

      await generate({
        outDir: 'case2',
        cwd: fixturesRoot,
        extensions: {
          json: 'js',
          wxss: 'less',
        },
      })

      await expect(readFile(outputRoot, 'case2.js')).resolves.toBe('Component({})')
      await expect(readFile(outputRoot, 'case2.less')).resolves.toBe('')
      await expect(readFile(outputRoot, 'case2.wxml')).resolves.toBe('<view>hello weapp-vite!</view>\n<view>from case2/case2</view>')
      await expect(readFile(outputRoot, 'case2.json.js')).resolves.toContain('defineComponentJson({')
    })

    describe('templates', () => {
      async function createTempProject() {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-generate-'))
        return {
          projectRoot,
          outputRoot: path.join(projectRoot, 'output'),
          async cleanup() {
            await fs.remove(projectRoot)
          },
        }
      }

      it('supports inline, relative-path, and functional overrides', async () => {
        const temp = await createTempProject()

        try {
          const templateDir = path.join(temp.projectRoot, 'templates')
          await fs.ensureDir(templateDir)
          const wxmlTemplatePath = path.join(templateDir, 'component.wxml')
          await fs.outputFile(wxmlTemplatePath, '<view>custom template</view>')

          await generate({
            outDir: 'output',
            cwd: temp.projectRoot,
            fileName: 'index',
            templates: {
              component: {
                js: { content: 'Component({ custom: true })' },
                wxml: {
                  path: path.relative(temp.projectRoot, wxmlTemplatePath),
                },
              },
              shared: {
                wxss: () => '.root { color: red; }',
              },
            },
          })

          await expect(readFile(temp.outputRoot, 'index.js')).resolves.toBe('Component({ custom: true })')
          await expect(readFile(temp.outputRoot, 'index.wxss')).resolves.toBe('.root { color: red; }')
          await expect(readFile(temp.outputRoot, 'index.wxml')).resolves.toBe('<view>custom template</view>')
          const json = await readFile(temp.outputRoot, 'index.json')
          expect(JSON.parse(json)).toEqual({
            $schema: 'https://vite.icebreaker.top/component.json',
            component: true,
            styleIsolation: 'apply-shared',
            usingComponents: {},
          })
        }
        finally {
          await temp.cleanup()
        }
      })

      it('awaits async factories and falls back to defaults when needed', async () => {
        const temp = await createTempProject()

        try {
          await generate({
            outDir: 'page',
            cwd: temp.projectRoot,
            type: 'page',
            templates: {
              page: {
                js: async ({ fileName }) => `Page({ name: '${fileName}' })`,
                wxml: () => undefined,
              },
              shared: {
                json: { content: '{"from":"shared"}' },
                wxss: async ({ fileName }) => `.${fileName} { color: blue; }`,
              },
            },
          })

          const pageRoot = path.join(temp.projectRoot, 'page')
          await expect(readFile(pageRoot, 'page.js')).resolves.toBe('Page({ name: \'page\' })')
          await expect(readFile(pageRoot, 'page.wxss')).resolves.toBe('.page { color: blue; }')
          const pageJson = await readFile(pageRoot, 'page.json')
          expect(JSON.parse(pageJson)).toEqual({ from: 'shared' })
          await expect(readFile(pageRoot, 'page.wxml')).resolves.toBe('<view>hello weapp-vite!</view>\n<view>from page/page</view>')
        }
        finally {
          await temp.cleanup()
        }
      })
    })
  })
})
