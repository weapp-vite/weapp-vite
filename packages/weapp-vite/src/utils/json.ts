import type { AliasOptions, Entry, ResolvedAlias } from '../types'
import { get, isObject, set } from '@weapp-core/shared'
import { parse as parseJson, stringify } from 'comment-json'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../logger'

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

export async function readCommentJson(filepath: string) {
  try {
    return parseCommentJson(await fs.readFile(filepath, 'utf8'))
  }
  catch {
    logger.error(`残破的JSON文件: ${filepath}`)
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

function getEntries({ entries }: AliasOptions): readonly ResolvedAlias[] {
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

export function resolveJson(entry: Partial<Entry>, options?: AliasOptions) {
  if (entry.json) {
    const json = structuredClone(entry.json)
    if (entry.jsonPath && isObject(options)) {
      const entries = getEntries(options)

      const usingComponents: Record<string, string> = get(json, 'usingComponents')
      if (isObject(usingComponents)) {
        for (const [key, importee] of Object.entries(usingComponents)) {
          const matchedEntry = entries.find(x => matches(x.find, importee))
          if (!matchedEntry) {
            continue
          }

          const updatedId = importee.replace(matchedEntry.find, matchedEntry.replacement)
          const resolvedId = path.relative(path.dirname(entry.jsonPath), updatedId)
          set(json, `usingComponents.${key}`, resolvedId)
        }

        set(json, 'usingComponents', usingComponents)
      }
    }
    return stringifyJson(json)
  }
}
