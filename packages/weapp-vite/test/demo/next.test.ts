/* eslint-disable ts/no-unused-vars */
import type { CompilerContext } from '@/context'
import type { Plugin, ResolvedConfig } from 'vite'
import { createCompilerContext } from '@/createContext'
import { changeFileExtension, findJsonEntry } from '@/utils/file'
import { jsonFileRemoveJsExtension, stringifyJson } from '@/utils/json'
import { } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'vite'
// import { pages } from '../../../../apps/vite-native/app.json'

// console.log(pages)
// const cwd = import.meta.dirname

// const virtualModuleId = 'virtual:pages'
// const resolvedVirtualModuleId = `\0${virtualModuleId}`
const removePlugins = ['vite:build-import-analysis']

const FIND_MAP = {
  app: {
    json: {
      loads: ['pages', 'usingComponents', 'subPackages'],
      required: true,
    },
    js: {
      required: true,
    },
    css: {
      required: false,
    },
  },
  page: {
    js: {
      required: true,
    },
    template: {
      required: true,
    },
    json: {
      loads: ['usingComponents'],
      required: false,
    },
    css: {
      required: false,
    },
  },
  component: {
    js: {
      required: true,
    },
    template: {
      required: true,
    },
    json: {
      loads: ['usingComponents'],
      required: true,
    },
    css: {
      required: false,
    },
  },
}

function weappVite(ctx: CompilerContext): Plugin[] {
  return [
    {
      name: 'test',
      async config(config, env) {

      },
      async configResolved(config: ResolvedConfig) {
        for (const removePlugin of removePlugins) {
          const idx = config.plugins?.findIndex(x => x.name === removePlugin)
          if (idx > -1) {
            (config.plugins as Plugin[]).splice(idx, 1)
          }
        }
      },
      resolveId(id) {

      },
      async load(id) {
        // App
        if ([
          'app.js',
          'app.ts',
        ].includes(
          ctx
            .configService
            .relativeAbsoluteSrcRoot(id),
        )) {
          const p = await findJsonEntry(id)
          if (p) {
            const json = await ctx.jsonService.read(p)
            const pages = json.pages as string[]

            await Promise.all(
              pages.map((x) => {
                return path.resolve(ctx.configService.absoluteSrcRoot, x)
              }).map(async (x) => {
                const resolvedId = await this.resolve(x)
                if (resolvedId) {
                  await this.load(resolvedId)
                  const fileName = ctx.configService.relativeAbsoluteSrcRoot(changeFileExtension(resolvedId.id, '.js'))
                  this.emitFile(
                    {
                      type: 'chunk',
                      id: resolvedId.id,
                      fileName,
                    },
                  )
                }
              }),
            )

            this.emitFile(
              {
                type: 'asset',
                fileName: ctx.configService.relativeAbsoluteSrcRoot(jsonFileRemoveJsExtension(p)),
                source: stringifyJson(json),
              },
            )
          }
        }
      },
      async transform(code, id) {

      },
    },
  ]
}

async function main() {
  const root = path.resolve(import.meta.dirname, '../../../../apps/vite-native')
  const ctx = await createCompilerContext({
    cwd: root,
  })
  await build({
    root,
    configFile: false,
    build: {
      outDir: 'dist-next',
      rollupOptions: {
        input: {
          app: path.resolve(root, 'app.js'),
        },
        external: ['@weapp-tailwindcss/merge', 'dayjs', 'lodash', '@/assets/logo.png'],
        output: {
          entryFileNames(chunkInfo) {
            return `${chunkInfo.name}.js`
          },
          // chunkFileNames(chunkInfo) {
          //   return `${chunkInfo.name}.js`
          // },
        },

      },
      minify: false,
      assetsDir: '.',

    },

    plugins: [
      weappVite(ctx),
    ],
  })
  return {
    ctx,
    root,
  }
}

describe('test', () => {
  it('should ', async () => {
    const { root } = await main()
    const pages = [
      'pages/index/index',
      'pages/index/test',
      'pages/test/test',
      'pages/test/require',
      'pages/button/button',
      'pages/button/skyline/button',
      'pages/LoveFromChina/index',
      'pages/LoveFromChina/LoveFromChina',
    ]

    expect(
      (
        await Promise
          .all(
            pages
              .map((x) => {
                return Promise.all([
                  fs.exists(path.resolve(root, `dist-next/${x}.js`)),
                  // fs.exists(path.resolve(root, `dist-next/${x}.json`)),
                ]).then(x => x.every(x => x === true))
              }),
          )
      ).every(x => x === true),
    ).toBe(true)
  })
})
