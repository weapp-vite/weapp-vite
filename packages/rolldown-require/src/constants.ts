import { readFileSync } from 'node:fs'

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)).toString(),
)

export const VERSION = version as string

export const DEV_PROD_CONDITION = `development|production` as const

export const JS_TYPES_RE = /\.(?:j|t)sx?$|\.mjs$/

export const OPTIMIZABLE_ENTRY_RE = /\.[cm]?[jt]s$/

export const SPECIAL_QUERY_RE = /[?&](?:worker|sharedworker|raw|url)\b/
