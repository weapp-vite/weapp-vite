import type { CompilerContext } from '@/context'
import type { Entry } from '@/types'
import type { EmittedAsset, PluginContext } from 'rollup'
import type { Plugin, ResolvedConfig } from 'vite'
import { createCompilerContext } from '@/createContext'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '@/utils/file'
import { jsonFileRemoveJsExtension, stringifyJson } from '@/utils/json'
import { handleWxml } from '@/wxml/handle'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'vite'
import commonjs from 'vite-plugin-commonjs'
import tsconfigPaths from 'vite-tsconfig-paths'
import { analyzeAppJson, analyzeCommonJson } from './analyze'

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

  const jsonEmitFilesMap: Map<string, EmittedAsset & { rawSource: any }> = new Map()
  // const templateEmitFilesMap: Map<string, EmittedAsset & { rawSource: any }> = new Map()
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

  async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    const p = await findJsonEntry(id)
    if (p) {
      const json = await ctx.jsonService.read(p)
      const entries: string[] = []
      if (type === 'app') {
        entries.push(...analyzeAppJson(json))
      }
      else {
        entries.push(...analyzeCommonJson(json))

        const templateEntry = await findTemplateEntry(id)
        if (templateEntry) {
          await ctx.wxmlService.scan(templateEntry)
        }
      }

      for (const entry of entries) {
        entriesMap.set(entry, undefined)
      }

      await Promise.all(
        [
          ...emitEntriesChunks.call(this, entries),
        ],
      )
      const fileName = ctx.configService.relativeAbsoluteSrcRoot(jsonFileRemoveJsExtension(p))

      jsonEmitFilesMap.set(fileName, {
        type: 'asset',
        fileName,
        rawSource: json,
      })
    }
  }

  return [
    {
      name: 'test',
      buildStart() {
        ctx.scanService.resetEntries()
      },
      options() {

      },
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
        const relativeBasename = removeExtensionDeep(
          ctx
            .configService
            .relativeAbsoluteSrcRoot(id),
        )

        if (entriesMap.has(relativeBasename)) {
          await loadEntry.call(this, id, 'component')
        }
        else if ([
          'app',
        ].includes(
          relativeBasename,
        )) {
          // isApp
          await loadEntry.call(this, id, 'app')
        }
      },
      buildEnd() {
        // ctx.wxmlService.scan()
      },
      generateBundle() {
        for (const jsonEmitFile of jsonEmitFilesMap.values()) {
          this.emitFile(
            {
              type: 'asset',
              fileName: jsonEmitFile.fileName,
              source: stringifyJson(jsonEmitFile.rawSource),
            },
          )
        }
        for (const [id, token] of ctx.wxmlService.tokenMap.entries()) {
          this.emitFile(
            {
              type: 'asset',
              fileName: ctx.configService.relativeAbsoluteSrcRoot(id), // templateEmitFile.fileName,
              source: handleWxml(token).code,
            },
          )
        }
        // for (const templateEmitFile of templateEmitFilesMap.values()) {
        //   this.emitFile(
        //     {
        //       type: 'asset',
        //       fileName: templateEmitFile.fileName,
        //       source: templateEmitFile.rawSource,
        //     },
        //   )
        // }
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
      'custom-tab-bar/index',
      'app-bar/index',
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
