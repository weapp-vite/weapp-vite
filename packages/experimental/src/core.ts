import type { CompilerContext } from '#src/context'
import type { Plugin } from 'rolldown-vite'
import { supportedCssLangs } from '#src/constants'
import { useLoadEntry } from '#src/plugins/hooks/useLoadEntry'
import { analyzeAppJson, analyzeCommonJson } from '#src/plugins/utils/analyze'
import { getCssRealPath, parseRequest } from '#src/plugins/utils/parse'
import { changeFileExtension, findJsonEntry, findTemplateEntry, isCSSRequest, isJsOrTs, jsonFileRemoveJsExtension, stringifyJson } from '#src/utils'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'

export async function customLoadEntryPlugin(ctx: CompilerContext): Promise<Plugin[]> {
  const plugins: Plugin[] = []
  const { jsonService, configService } = ctx
  const jsonMap = new Map<string, any>()
  const loadedEntrySet = new Set<string>()
  const { normalizeEntry } = useLoadEntry(ctx)

  plugins.push({
    name: 'weapp-vite:custom-build',
    // enforce: 'pre',
    buildStart() {
      loadedEntrySet.clear()
    },
    // https://github.com/vitejs/rolldown-vite/issues/339
    // https://github.com/rolldown/rolldown/issues/5534
    resolveId(source, importer) {
      console.log('resolveId', source, importer)
      if (source.endsWith('.wxss')) {
        return source.replace(/\.wxss$/, '.css?wxss')
      }
    },

    async load(id, _options) {
      console.log('load', id)
      // const relativeCwdId = configService.relativeCwd(id)
      // const baseName = removeExtensionDeep(id)

      const loadEntry = async (type: 'app' | 'page' | 'component') => {
        const { path: jsonPath } = await findJsonEntry(id)
        if (jsonPath) {
          const json = await jsonService.read(jsonPath)
          let entries: string[]
          if (type === 'app') {
            entries = analyzeAppJson(json)
          }
          else {
            entries = analyzeCommonJson(json)
          }
          // console.log('entries', entries)
          const normalizedEntries = entries.map(entry => normalizeEntry(entry, jsonPath))

          const resolveIds = await Promise.all(normalizedEntries
            .filter(
              // 排除 plugin: 和 npm:
              entry => !entry.includes(':'),
            )
            .map(
              async (entry) => {
                const absPath = path.resolve(configService.absoluteSrcRoot, entry)
                return {
                  entry,
                  resolvedId: await this.resolve(absPath),
                }
              },
            ))
          // console.log('resolveIds', resolveIds)
          await Promise.all(resolveIds
            .filter(x => x.resolvedId)
            .map(async ({ resolvedId }) => {
              // console.log(resolvedId)
              loadedEntrySet.add(resolvedId!.id)
              await this.load({
                ...resolvedId!,
                // meta: {},
              })

              const fileName = configService.relativeAbsoluteSrcRoot(changeFileExtension(resolvedId!.id, '.js'))
              this.emitFile(
                {
                  type: 'chunk',
                  id: resolvedId!.id,
                  fileName,
                  preserveSignature: 'exports-only',
                },
              )
            }))

          jsonMap.set(jsonPath, json)
        }
        const { path: templatePath } = await findTemplateEntry(id)
        // app 是没有 wxml 的
        if (type !== 'app') {
          if (templatePath) {
            const resolveId = await this.resolve(templatePath)
            if (resolveId) {
              const info = await this.load(resolveId)
              console.log(info)
            }
          }
        }

        const code = await fs.readFile(id, 'utf8')
        const ms = new MagicString(code)
        for (const ext of supportedCssLangs) {
          const mayBeCssPath = changeFileExtension(id, ext)
          // 监控其他的文件是否产生
          this.addWatchFile(mayBeCssPath)
          if (await fs.exists(mayBeCssPath)) {
            ms.prepend(`import '${mayBeCssPath}';\n`)
          }
        }
        return {
          code: ms.toString(),
        }
        // const { path: cssPath } = await findCssEntry(id)
        // if (cssPath) {
        //   // const resolvedId = await this.resolve(cssPath, id)
        //   await this.load({ id: cssPath })
        // }
      }

      const relativeBasename = removeExtensionDeep(
        configService
          .relativeAbsoluteSrcRoot(id),
      )
      this.addWatchFile(id)
      if (isCSSRequest(id)) {
        const parsed = parseRequest(id)

        if (parsed.query.wxss) {
          const realPath = getCssRealPath(parsed)
          this.addWatchFile(realPath)
          if (await fs.exists(realPath)) {
            const css = await fs.readFile(realPath, 'utf8')
            return {
              code: css,
            }
          }
        }
        return null
      }
      else {
        if (loadedEntrySet.has(id)) {
          return await loadEntry('component')
        }
        else if (['app'].includes(relativeBasename)) {
          return await loadEntry('app')
        }
      }

      // fs.pathExists
      // fs.exists
    },
    transform(_code, id, _options) {
      console.log('[transform]', id)
      if (isJsOrTs(id)) {
        return null
      }
      else if (id.endsWith('.wxml')) {
        return ''
      }
      else if (id.endsWith('.wxss')) {
        return ''
      }
    },
    moduleParsed(info) {
      console.log('[moduleParsed]', info.id)
    },
  })

  plugins.push({
    name: 'weapp-vite:custom-output',
    renderStart() {
      [...jsonMap.entries()].forEach(([jsonPath, json]) => {
        this.emitFile({
          type: 'asset',
          fileName: configService.relativeAbsoluteSrcRoot(jsonFileRemoveJsExtension(jsonPath)),
          source: stringifyJson(json),
        })
      })
    },
    generateBundle(_opions, bundle) {
      console.log('[generateBundle]', Object.keys(bundle))
    },
  })

  return plugins
}
