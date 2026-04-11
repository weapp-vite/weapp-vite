export {
  APP_PRELUDE_CHUNK_MARKER,
  APP_PRELUDE_GUARD_KEY,
  APP_PRELUDE_REQUIRE_MARKER,
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_BUNDLE_MARKER,
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  REQUEST_GLOBAL_PLACEHOLDER_KEY,
  REQUEST_GLOBAL_PRELUDE_GUARD_KEY,
  REQUEST_GLOBAL_PRELUDE_MARKER,
} from '@weapp-core/constants'

export const platformApiIdentifiers = new Set(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'])
export const NPM_PROTOCOL_RE = /^npm:/
export const ABSOLUTE_NPM_PREFIX_RE = /^\/(?:miniprogram_npm|node_modules)\//
export const PRETTY_NODE_MODULES_RE = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(.+)/
export const REQUEST_GLOBAL_EXPORT_RE = /Object\.defineProperty\(exports,\s*(?:`([^`]+)`|'([^']+)'|"([^"]+)"),\s*\{[\s\S]*?get:function\(\)\{return ([A-Za-z_$][\w$]*)\}\}\)/g
export const REQUEST_GLOBAL_INSTALLER_RE = /function\s+([A-Za-z_$][\w$]*)\([^)]*=\{\}\)\{[\s\S]{0,220}?targets\?\?\[[\s\S]{0,80}?fetch[\s\S]{0,80}?Headers[\s\S]{0,80}?Request[\s\S]{0,80}?Response[\s\S]{0,80}?AbortController[\s\S]{0,80}?AbortSignal[\s\S]{0,80}?XMLHttpRequest[\s\S]{0,80}?WebSocket[\s\S]{0,260}?return [^}]+\}/
export const REQUEST_GLOBAL_ENTRY_NAME_RE = /\.[^/.]+$/
export const REQUEST_GLOBAL_REQUIRE_DECLARATOR_RE = /([A-Za-z_$][\w$]*)\s*=\s*require\((`([^`]+)`|'([^']+)'|"([^"]+)")\)/g
export const REQUEST_GLOBAL_RUNTIME_CHUNK_FILE_BASENAME = 'request-globals-runtime.js'
export const DYNAMIC_GLOBAL_RESOLUTION_RE = /Function\(\s*(?:`return this`|'return this'|"return this")\s*\)\(\)/g
export const BROWSER_GLOBAL_HOST_TERNARY_RE = /typeof self<[`'"]u[`'"]\?self:typeof window<[`'"]u[`'"]\?window:globalThis/g
export const AXIOS_MODULE_ID_RE = /[/\\](?:\.pnpm[/\\][^/\\]+[/\\]node_modules[/\\])?axios[/\\]/u
export const APP_PRELUDE_REQUIRE_FILE_BASENAME = 'app.prelude.js'
export const DIRECTIVE_PROLOGUE_RE = /^(?:(['"])(?:\\.|(?!\1)[^\\])*\1;?\s*)+/u
export const USE_STRICT_PREFIX_RE = /^(?:['"]use strict['"];\s*)+/u
