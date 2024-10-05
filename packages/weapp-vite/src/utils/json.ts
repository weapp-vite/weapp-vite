import { get, isObject, set } from '@weapp-core/shared'
import { parse as parseJson, stringify } from 'comment-json'
import fs from 'fs-extra'
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

export function resolveJson(value: object, alias?: Record<string, string>) {
  if (isObject(alias)) {
    const usingComponents = get(value, 'usingComponents')
    if (isObject(usingComponents)) {
      set(value, 'usingComponents', usingComponents)
    }
  }
  return stringifyJson(value)
}
