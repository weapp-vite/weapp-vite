import { readFileSync } from 'node:fs'

const BOM_RE = /^\uFEFF/

function stripBom(value: string) {
  return value.replace(BOM_RE, '')
}

const { version } = JSON.parse(
  stripBom(readFileSync(new URL('../package.json', import.meta.url), 'utf8')),
)

export const VERSION = version as string

export const DEV_PROD_CONDITION = `development|production` as const

export const JS_TYPES_RE = /\.(?:j|t)sx?$|\.mjs$/

export const OPTIMIZABLE_ENTRY_RE = /\.[cm]?[jt]s$/

export const SPECIAL_QUERY_RE = /[?&](?:worker|sharedworker|raw|url)\b/
