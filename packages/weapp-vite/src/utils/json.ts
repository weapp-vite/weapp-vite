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

export function stringifyJson(value: unknown, replacer?: (
  (key: string, value: unknown) => unknown
) | Array<number | string> | null) {
  return stringify(value, replacer, 2)
}

export function resolveJson(value: unknown) {
  return stringifyJson(value)
}
