import { parse as parseJson, stringify } from 'comment-json'

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

export function jsonFileRemoveJsExtension(fileName: string) {
  return fileName.replace(/\.[jt]s$/, '')
}

export function stringifyJson(value: object, replacer?: (
  (key: string, value: unknown) => unknown
) | Array<number | string> | null) {
  return stringify(value, replacer, 2)
}
