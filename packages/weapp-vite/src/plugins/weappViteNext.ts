import type { CompilerContext } from '@/context'
import type { Entry } from '@/types'
import type { EmittedAsset, PluginContext } from 'rollup'
import type { Plugin } from 'vite'
import { supportedCssLangs } from '@/constants'
import { getCssRealPath, parseRequest } from '@/plugins/parse'
import { isCSSRequest } from '@/utils'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '@/utils/file'
import { jsonFileRemoveJsExtension, stringifyJson } from '@/utils/json'
import { handleWxml } from '@/wxml/handle'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { analyzeAppJson, analyzeCommonJson } from './analyze'
import { preflight } from './preflight'

// const FIND_MAP = {
//   app: {
//     json: {
//       loads: ['pages', 'usingComponents', 'subPackages'],
//       required: true,
//     },
//     js: {
//       required: true,
//     },
//     css: {
//       required: false,
//     },
//   },
//   page: {
//     js: {
//       required: true,
//     },
//     template: {
//       required: true,
//     },
//     json: {
//       loads: ['usingComponents'],
//       required: false,
//     },
//     css: {
//       required: false,
//     },
//   },
//   component: {
//     js: {
//       required: true,
//     },
//     template: {
//       required: true,
//     },
//     json: {
//       loads: ['usingComponents'],
//       required: true,
//     },
//     css: {
//       required: false,
//     },
//   },
// }

export function weappViteNext(ctx: CompilerContext): Plugin[] {
  const entriesMap = new Map<string, Entry | undefined>()

  // let resolvedConfig: ResolvedConfig

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
      const code = await fs.readFile(id, 'utf8')
      const ms = new MagicString(code)
      for (const ext of supportedCssLangs) {
        const mayBeCssPath = changeFileExtension(id, ext)

        if (await fs.exists(mayBeCssPath)) {
          ms.prepend(`import '${mayBeCssPath}'\n`)
        }
      }
      return {
        code: ms.toString(),
      }
    }
  }

  return [
    ...preflight(ctx),
    {
      name: 'test',
      options() {
        ctx.scanService.resetEntries()
      },
      resolveId(id) {
        if (id.endsWith('.wxss')) {
          return id.replace(/\.wxss$/, '.css?wxss')
        }
      },
      async load(id) {
        const relativeBasename = removeExtensionDeep(
          ctx
            .configService
            .relativeAbsoluteSrcRoot(id),
        )

        if (entriesMap.has(relativeBasename)) {
          return await loadEntry.call(this, id, 'component')
        }
        else if ([
          'app',
        ].includes(
          relativeBasename,
        )) {
          // isApp
          return await loadEntry.call(this, id, 'app')
        }
        else if (isCSSRequest(id)) {
          const parsed = parseRequest(id)
          const realPath = getCssRealPath(parsed)
          if (await fs.exists(realPath)) {
            const css = await fs.readFile(realPath, 'utf8')
            return {
              code: css,
            }
          }
        }
      },
      buildEnd() {
        // ctx.wxmlService.scan()
      },
      generateBundle(_opts, _bundle) {
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

// async function main() {
//   const root = viteNativeRoot
//   const ctx = await createCompilerContext({
//     cwd: root,
//   })
//   await build({
//     root,
//     configFile: false,
//     build: {
//       outDir: 'dist-next',
//       rollupOptions: {
//         input: {
//           app: path.resolve(root, 'app.js'),
//         },
//         external: ['@weapp-tailwindcss/merge', 'dayjs', 'lodash', '@/assets/logo.png'],
//         output: {
//           entryFileNames(chunkInfo) {
//             return `${chunkInfo.name}.js`
//           },
//         },

//       },
//       minify: false,
//       assetsDir: '.',

//     },

//     plugins: [
//       weappVite(ctx),
//       tsconfigPaths(),
//       commonjs(),
//     ],
//   })
//   return {
//     ctx,
//     root,
//   }
// }
