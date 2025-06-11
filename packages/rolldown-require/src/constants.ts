import type { RollupPluginHooks } from './typeUtils'
import { readFileSync } from 'node:fs'
import path, { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)).toString(),
)

export const ROLLUP_HOOKS = [
  'options',
  'buildStart',
  'buildEnd',
  'renderStart',
  'renderError',
  'renderChunk',
  'writeBundle',
  'generateBundle',
  'banner',
  'footer',
  'augmentChunkHash',
  'outputOptions',
  // 'renderDynamicImport',
  // 'resolveFileUrl',
  // 'resolveImportMeta',
  'intro',
  'outro',
  'closeBundle',
  'closeWatcher',
  'load',
  'moduleParsed',
  'watchChange',
  'resolveDynamicImport',
  'resolveId',
  // 'shouldTransformCachedModule',
  'transform',
  'onLog',
] satisfies RollupPluginHooks[]

export const VERSION = version as string

const DEFAULT_MAIN_FIELDS = [
  'browser',
  'module',
  'jsnext:main', // moment still uses this...
  'jsnext',
]
export const DEFAULT_CLIENT_MAIN_FIELDS = Object.freeze(DEFAULT_MAIN_FIELDS)
export const DEFAULT_SERVER_MAIN_FIELDS = Object.freeze(
  DEFAULT_MAIN_FIELDS.filter(f => f !== 'browser'),
)

/**
 * A special condition that would be replaced with production or development
 * depending on NODE_ENV env variable
 */
export const DEV_PROD_CONDITION = `development|production` as const

const DEFAULT_CONDITIONS = ['module', 'browser', 'node', DEV_PROD_CONDITION]
export const DEFAULT_CLIENT_CONDITIONS = Object.freeze(
  DEFAULT_CONDITIONS.filter(c => c !== 'node'),
)
export const DEFAULT_SERVER_CONDITIONS = Object.freeze(
  DEFAULT_CONDITIONS.filter(c => c !== 'browser'),
)

// Baseline support for:
// - es2020 (covers most of following features)
// - modules via script tag
// - dynamic imports
// - import.meta
// - nullish coalescing (??)
// - bigint
//
// Use this link to check for browser support (excludes es2020):
// https://caniuse.com/es6-module,es6-module-dynamic-import,mdn-javascript_operators_import_meta,mdn-javascript_operators_nullish_coalescing,bigint#:~:text=Feature%20summary
// NOTE: Browser versions may be slightly off as previously the browserslist special `"defaults"` query
// was used around May 2021, which targeted browsers with >0.5% usage at the time.
export const ESBUILD_MODULES_TARGET = [
  'es2020',
  'edge88',
  'firefox78',
  'chrome87',
  'safari14',
]

export const DEFAULT_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts',
]

export const JS_TYPES_RE = /\.(?:j|t)sx?$|\.mjs$/

export const CSS_LANGS_RE
  = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/

export const OPTIMIZABLE_ENTRY_RE = /\.[cm]?[jt]s$/

export const SPECIAL_QUERY_RE = /[?&](?:worker|sharedworker|raw|url)\b/

/**
 * Prefix for resolved fs paths, since windows paths may not be valid as URLs.
 */
export const FS_PREFIX = `/@fs/`

export const CLIENT_PUBLIC_PATH = `/@vite/client`
export const ENV_PUBLIC_PATH = `/@vite/env`
export const VITE_PACKAGE_DIR = resolve(
  // import.meta.url is `dist/node/constants.js` after bundle
  fileURLToPath(import.meta.url),
  '../../..',
)

export const CLIENT_ENTRY = resolve(VITE_PACKAGE_DIR, 'dist/client/client.mjs')
export const ENV_ENTRY = resolve(VITE_PACKAGE_DIR, 'dist/client/env.mjs')
export const CLIENT_DIR = path.dirname(CLIENT_ENTRY)

export const DEP_VERSION_RE = /[?&](v=[\w.-]+)\b/

export const loopbackHosts = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0000:0000:0000:0000:0000:0000:0000:0001',
])
export const wildcardHosts = new Set([
  '0.0.0.0',
  '::',
  '0000:0000:0000:0000:0000:0000:0000:0000',
])

export const DEFAULT_DEV_PORT = 5173

export const DEFAULT_PREVIEW_PORT = 4173

export const DEFAULT_ASSETS_INLINE_LIMIT = 4096

// the regex to allow loopback address origins:
// - localhost domains (which will always resolve to the loopback address by RFC 6761 section 6.3)
// - 127.0.0.1
// - ::1
export const defaultAllowedOrigins
  = /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/

export const METADATA_FILENAME = '_metadata.json'

export const ERR_OPTIMIZE_DEPS_PROCESSING_ERROR
  = 'ERR_OPTIMIZE_DEPS_PROCESSING_ERROR'
export const ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR
  = 'ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR'

/**
 * Prefix for resolved Ids that are not valid browser import specifiers
 */
export const VALID_ID_PREFIX = `/@id/`

/**
 * Plugins that use 'virtual modules' (e.g. for helper functions), prefix the
 * module ID with `\0`, a convention from the rollup ecosystem.
 * This prevents other plugins from trying to process the id (like node resolution),
 * and core features like sourcemaps can use this info to differentiate between
 * virtual modules and regular files.
 * `\0` is not a permitted char in import URLs so we have to replace them during
 * import analysis. The id will be decoded back before entering the plugins pipeline.
 * These encoded virtual ids are also prefixed by the VALID_ID_PREFIX, so virtual
 * modules in the browser end up encoded as `/@id/__x00__{id}`
 */
export const NULL_BYTE_PLACEHOLDER = `__x00__`

export let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

export const MODULE_RUNNER_SOURCEMAPPING_SOURCE
  = '//# sourceMappingSource=vite-generated'

export const ERR_OUTDATED_OPTIMIZED_DEP = 'ERR_OUTDATED_OPTIMIZED_DEP'
