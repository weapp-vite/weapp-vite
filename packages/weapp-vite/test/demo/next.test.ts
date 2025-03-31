import type { CompilerContext } from '@/context'
import type { Entry } from '@/types'
import type { App, Component, Page } from '@weapp-core/schematics'
import type { PluginContext } from 'rollup'
import type { Plugin, ResolvedConfig } from 'vite'
import { createCompilerContext } from '@/createContext'
import { changeFileExtension, findJsonEntry } from '@/utils/file'
import { jsonFileRemoveJsExtension, stringifyJson } from '@/utils/json'
import { removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'vite'
import commonjs from 'vite-plugin-commonjs'
import tsconfigPaths from 'vite-tsconfig-paths'
// import { pages } from '../../../../apps/vite-native/app.json'

// console.log(pages)
// const cwd = import.meta.dirname

// const virtualModuleId = 'virtual:pages'
// const resolvedVirtualModuleId = `\0${virtualModuleId}`
const removePlugins = ['vite:build-import-analysis']

// eslint-disable-next-line ts/no-unused-vars
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
  const entriesMap = new Map<string, Entry | undefined>()
  // eslint-disable-next-line ts/no-unused-vars
  let resolvedConfig: ResolvedConfig
  function emitEntriesChunks(this: PluginContext, entries: string[]) {
    return entries.map(async (x) => {
      const absPath = path.resolve(ctx.configService.absoluteSrcRoot, x)
      const resolvedId = await this.resolve(absPath)
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
    })
  }
  return [
    {
      name: 'test',
      // async config(config, env) {

      // },
      async configResolved(config: ResolvedConfig) {
        for (const removePlugin of removePlugins) {
          const idx = config.plugins?.findIndex(x => x.name === removePlugin)
          if (idx > -1) {
            (config.plugins as Plugin[]).splice(idx, 1)
          }
        }
        resolvedConfig = config
      },
      resolveId(id) {
        console.log('resolveId', id)
      },
      async load(id) {
        const rltps = removeExtension(
          ctx
            .configService
            .relativeAbsoluteSrcRoot(id),
        )
        console.log('load', rltps)
        if (entriesMap.has(rltps)) {
          const p = await findJsonEntry(id)
          if (p) {
            const json: Page | Component = await ctx.jsonService.read(p)

            const components = Object.values(json.usingComponents ?? {})

            const entries = components
            for (const entry of entries) {
              entriesMap.set(entry, undefined)
            }

            await Promise.all(
              [
                ...emitEntriesChunks.call(this, entries),
              ],
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
        else if ([
          'app',
        ].includes(
          rltps,
        )) {
          // isApp
          const p = await findJsonEntry(id)
          if (p) {
            const json: App = await ctx.jsonService.read(p)
            const pages = (json.pages as string[]) ?? []
            const components = Object.values(json.usingComponents ?? {})
            const subPackages = (
              json.subPackages?.reduce<string[]>(
                (acc, cur) => {
                  acc.push(...(cur.pages ?? []).map(x => `${cur.root}/${x}`))
                  return acc
                },
                [],
              )) ?? []
            const entries = [...pages, ...components, ...subPackages]
            for (const entry of entries) {
              entriesMap.set(entry, undefined)
            }

            await Promise.all(
              [
                ...emitEntriesChunks.call(this, entries),
              ],
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
      // async transform(code, id) {

      // },
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
      tsconfigPaths(),
      commonjs(),
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
