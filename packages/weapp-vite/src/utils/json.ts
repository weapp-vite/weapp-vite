import type { CompilerContext } from '../context'
import type { AliasOptions, Entry, EntryJsonFragment, ResolvedAlias, SubPackage } from '../types'
import { pathToFileURL } from 'node:url'
import { get, isObject, set } from '@weapp-core/shared'
import { parse as parseJson, stringify } from 'comment-json'
import fs from 'fs-extra'
import path from 'pathe'
import { tsImport } from 'tsx/esm/api'
import logger from '../logger'
import { changeFileExtension } from './file'

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

export function jsonFileRemoveJsExtension(fileName: string) {
  return fileName.replace(/\.[jt]s$/, '')
}
// https://github.com/privatenumber/tsx/issues/345
// https://github.com/nodejs/node/issues/34765#issuecomment-674096790
// export async function readCommentJson(filepath: string, platform?: MpPlatform) {
//   try {
//     if (/\.json\.[jt]s$/.test(filepath)) {
//       const { mod } = await bundleRequire({
//         filepath,
//         esbuildOptions: {
//           define: {
//             'import.meta.env.MP_PLATFORM': JSON.stringify(platform),
//           },
//         },
//       })
//       // const loaded = await tsImport(pathToFileURL(filepath).href, {
//       //   parentURL: import.meta.url,
//       // })
//       return mod.default
//     }
//     else {
//       return parseCommentJson(await fs.readFile(filepath, 'utf8'))
//     }
//   }
//   catch (error) {
//     logger.error(`残破的JSON文件: ${filepath}`)
//     logger.error(error)
//   }
// }

export function createReadCommentJson(ctx?: CompilerContext) {
  return async function readCommentJson(filepath: string) {
    try {
      if (/\.json\.[jt]s$/.test(filepath)) {
        const define: Record<string, any> = {}
        if (ctx) {
          define['import.meta.env.MP_PLATFORM'] = JSON.stringify(ctx.platform)
        }
        // const { mod } = await bundleRequire({
        //   filepath,
        //   cwd: ctx?.cwd,
        //   esbuildOptions: {
        //     define,
        //   },
        //   notExternal

        // })
        const mod = await tsImport(pathToFileURL(filepath).href, {
          parentURL: import.meta.url,
        })
        return mod.default
      }
      else {
        return parseCommentJson(await fs.readFile(filepath, 'utf8'))
      }
    }
    catch (error) {
      logger.error(`残破的JSON文件: ${filepath}`)
      logger.error(error)
    }
  }
}

export function stringifyJson(value: object, replacer?: (
  (key: string, value: unknown) => unknown
) | Array<number | string> | null) {
  return stringify(value, replacer, 2)
}

function matches(pattern: string | RegExp, importee: string) {
  if (pattern instanceof RegExp) {
    return pattern.test(importee)
  }
  if (importee.length < pattern.length) {
    return false
  }
  if (importee === pattern) {
    return true
  }
  // eslint-disable-next-line prefer-template
  return importee.startsWith(pattern + '/')
}

export function getAliasEntries({ entries }: AliasOptions = {}): ResolvedAlias[] {
  if (!entries) {
    return []
  }

  if (Array.isArray(entries)) {
    return entries.map((entry) => {
      return {
        find: entry.find,
        replacement: entry.replacement,

      }
    })
  }

  return Object.entries(entries).map(([key, value]) => {
    return { find: key, replacement: value }
  })
}

export function resolveImportee(importee: string, entry: EntryJsonFragment, aliasEntries?: ResolvedAlias[]) {
  if (Array.isArray(aliasEntries)) {
    if (!entry.jsonPath) {
      return importee
    }
    const matchedEntry = aliasEntries.find(x => matches(x.find, importee))
    if (!matchedEntry) {
      return importee
    }

    const updatedId = importee.replace(matchedEntry.find, matchedEntry.replacement)
    return path.relative(path.dirname(entry.jsonPath), updatedId)
  }
  return importee
}

export function resolveJson(entry: Partial<Pick<Entry, 'json' | 'jsonPath' | 'type'>>, aliasEntries?: ResolvedAlias[]) {
  if (entry.json) {
    const json = structuredClone(entry.json)
    if (entry.jsonPath && Array.isArray(aliasEntries)) {
      const usingComponents: Record<string, string> = get(json, 'usingComponents')
      if (isObject(usingComponents)) {
        for (const [key, importee] of Object.entries(usingComponents)) {
          const resolvedId = resolveImportee(importee, entry, aliasEntries)
          set(json, `usingComponents.${key}`, resolvedId)
        }

        set(json, 'usingComponents', usingComponents)
      }

      if (entry.type === 'app') {
        const fields = ['subPackages', 'subpackages']
        for (const field of fields) {
          const subPackages: SubPackage[] = get(json, field)
          if (Array.isArray(subPackages)) {
            for (const subPackage of subPackages) {
              if (subPackage.entry) {
                subPackage.entry = changeFileExtension(subPackage.entry, 'js')
              }
            }
          }
        }
      }
    }
    // 去除提示用的 $schema
    if (Reflect.has(json, '$schema')) {
      // @ts-ignore
      delete json.$schema
    }
    return stringifyJson(json)
  }
}
