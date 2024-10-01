import { parse as parseJson } from 'comment-json'

export function parseCommentJson(json: string) {
  try {
    return parseJson(json, undefined, true)
  }
  catch {

  }
}
