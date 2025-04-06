import type { CompilerContext } from '@/context'
import type { Entry, SubPackageMetaValue } from '@/types'
import type { EmittedAsset, PluginContext } from 'rollup'
import type { Plugin } from 'vite'
import { supportedCssLangs } from '@/constants'
import { getCssRealPath, parseRequest } from '@/plugins/parse'
import { isCSSRequest } from '@/utils'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '@/utils/file'
import { jsonFileRemoveJsExtension } from '@/utils/json'
import { handleWxml } from '@/wxml/handle'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { analyzeAppJson, analyzeCommonJson } from './analyze'

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

export function weappViteNext(ctx: CompilerContext, _subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const { scanService, configService, jsonService, wxmlService } = ctx
  const entriesMap = new Map<string, Entry | undefined>()

  const jsonEmitFilesMap: Map<string, EmittedAsset & { entry: {
    type: 'app' | 'page' | 'component'
    json: any
    jsonPath: string
  } }> = new Map()
  // const templateEmitFilesMap: Map<string, EmittedAsset & { rawSource: any }> = new Map()
  function emitEntriesChunks(this: PluginContext, entries: string[]) {
    return entries.map(async (x) => {
      const absPath = path.resolve(configService.absoluteSrcRoot, x)
      const resolvedId = await this.resolve(absPath)
      if (resolvedId) {
        await this.load(resolvedId)
        const fileName = configService.relativeAbsoluteSrcRoot(changeFileExtension(resolvedId.id, '.js'))
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
    // page 可以没有 json
    const jsonPath = await findJsonEntry(id)
    let json: any = {}
    if (jsonPath) {
      json = await jsonService.read(jsonPath)
    }

    const entries: string[] = []
    if (type === 'app') {
      entries.push(...analyzeAppJson(json))
    }
    else {
      entries.push(...analyzeCommonJson(json))

      const templateEntry = await findTemplateEntry(id)
      if (templateEntry) {
        await wxmlService.scan(templateEntry)
        this.addWatchFile(templateEntry)
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

    if (jsonPath) {
      const fileName = configService.relativeAbsoluteSrcRoot(jsonFileRemoveJsExtension(jsonPath))

      jsonEmitFilesMap.set(fileName, {
        type: 'asset',
        fileName,
        entry: {
          json,
          jsonPath,
          type,
        },
      })
    }

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

  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      async options(options) {
        scanService.resetEntries()
        const appEntry = await scanService.loadAppEntry()

        options.input = {
          app: appEntry.path,
        }
      },
      resolveId(id) {
        if (id.endsWith('.wxss')) {
          return id.replace(/\.wxss$/, '.css?wxss')
        }
      },
      async load(id) {
        const relativeBasename = removeExtensionDeep(
          configService
            .relativeAbsoluteSrcRoot(id),
        )
        if (isCSSRequest(id)) {
          const parsed = parseRequest(id)
          const realPath = getCssRealPath(parsed)
          if (await fs.exists(realPath)) {
            const css = await fs.readFile(realPath, 'utf8')
            return {
              code: css,
            }
          }
        }
        else if (entriesMap.has(relativeBasename)) {
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
      },
      buildEnd() {

      },
      generateBundle(_opts, _bundle) {
        for (const jsonEmitFile of jsonEmitFilesMap.values()) {
          this.emitFile(
            {
              type: 'asset',
              fileName: jsonEmitFile.fileName,
              source: jsonService.resolve(jsonEmitFile.entry),
            },
          )
        }
        for (const [id, token] of wxmlService.tokenMap.entries()) {
          this.emitFile(
            {
              type: 'asset',
              fileName: configService.relativeAbsoluteSrcRoot(id), // templateEmitFile.fileName,
              source: handleWxml(token).code,
            },
          )
        }
      },
    },
  ]
}
