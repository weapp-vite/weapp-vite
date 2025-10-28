import type { Plugin as RolldownPlugin } from 'rolldown'
import type { Plugin as VitePlugin } from 'vite'
import fs from 'fs-extra'
import { getPackageInfoSync } from 'local-pkg'
import path from 'pathe'
import logger from '../logger'

const NULL_BYTE = '\u0000'
// eslint-disable-next-line regexp/no-useless-non-capturing-group
const OXC_RUNTIME_HELPER_ALIAS = new RegExp(`^(?:${NULL_BYTE})?@oxc-project(?:/|\\+)runtime(?:@[^/]+)?/helpers/(.+)\\.js$`)
const FALLBACK_HELPER_PREFIX = `${NULL_BYTE}weapp-vite:oxc-helper:`
const fallbackHelpers: Record<string, string> = {
  objectWithoutProperties: `export default function _objectWithoutProperties(source, excluded) {\n  if (source == null) return {};\n  var target = {};\n  var sourceKeys = Object.keys(source);\n  var key;\n  for (var i = 0; i < sourceKeys.length; i++) {\n    key = sourceKeys[i];\n    if (excluded.indexOf(key) >= 0) continue;\n    if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;\n    target[key] = source[key];\n  }\n  if (Object.getOwnPropertySymbols) {\n    var symbolKeys = Object.getOwnPropertySymbols(source);\n    for (var i = 0; i < symbolKeys.length; i++) {\n      key = symbolKeys[i];\n      if (excluded.indexOf(key) >= 0) continue;\n      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;\n      target[key] = source[key];\n    }\n  }\n  return target;\n}`,
  objectSpread2: `function ownKeys(object, enumerableOnly) {\n  var keys = Object.keys(object);\n  if (Object.getOwnPropertySymbols) {\n    var symbols = Object.getOwnPropertySymbols(object);\n    if (enumerableOnly) {\n      symbols = symbols.filter(function(symbol) {\n        return Object.getOwnPropertyDescriptor(object, symbol).enumerable;\n      });\n    }\n    keys.push.apply(keys, symbols);\n  }\n  return keys;\n}\nfunction _objectSpread2(target) {\n  for (var i = 1; i < arguments.length; i++) {\n    var source = arguments[i] != null ? arguments[i] : {};\n    if (i % 2) {\n      ownKeys(Object(source), true).forEach(function(key) {\n        target[key] = source[key];\n      });\n    } else {\n      if (Object.getOwnPropertyDescriptors) {\n        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));\n      } else {\n        ownKeys(Object(source)).forEach(function(key) {\n          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));\n        });\n      }\n    }\n  }\n  return target;\n}\nexport default _objectSpread2;`,
}

function getOxcHelperName(id: string) {
  OXC_RUNTIME_HELPER_ALIAS.lastIndex = 0
  const match = OXC_RUNTIME_HELPER_ALIAS.exec(id)
  return match?.[1]
}

export interface OxcRuntimeAliasEntry {
  find: RegExp
  replacement: string
}

export interface OxcRuntimeSupport {
  alias: OxcRuntimeAliasEntry
  rolldownPlugin?: RolldownPlugin
  vitePlugin?: VitePlugin
}

export function createOxcRuntimeSupport(): OxcRuntimeSupport {
  const oxcRuntimeInfo = getPackageInfoSync('@oxc-project/runtime')
  const oxcRuntimeHelpersRoot = oxcRuntimeInfo
    ? path.resolve(oxcRuntimeInfo.rootPath, 'src/helpers/esm')
    : undefined

  const alias: OxcRuntimeAliasEntry = {
    find: OXC_RUNTIME_HELPER_ALIAS,
    replacement: '@oxc-project/runtime/src/helpers/esm/$1.js',
  }

  if (!oxcRuntimeHelpersRoot) {
    return {
      alias,
    }
  }

  const rolldownPlugin: RolldownPlugin = {
    name: 'weapp-vite:rolldown-oxc-runtime',
    resolveId(source) {
      if (source.startsWith(NULL_BYTE)) {
        return null
      }
      const helperName = getOxcHelperName(source)
      if (!helperName) {
        return null
      }
      const helpersRoot = oxcRuntimeHelpersRoot
      if (!helpersRoot) {
        if (helperName in fallbackHelpers) {
          return `${FALLBACK_HELPER_PREFIX}${helperName}`
        }
        return null
      }
      return path.resolve(helpersRoot, `${helperName}.js`)
    },
    async load(id) {
      if (id.startsWith(FALLBACK_HELPER_PREFIX)) {
        const helperName = id.slice(FALLBACK_HELPER_PREFIX.length)
        const code = fallbackHelpers[helperName]
        if (code) {
          return code
        }
        return null
      }
      const helperName = getOxcHelperName(id)
      if (helperName) {
        const helperPath = id.startsWith(NULL_BYTE)
          ? path.resolve(oxcRuntimeHelpersRoot, `${helperName}.js`)
          : id
        if (await fs.pathExists(helperPath)) {
          logger.warn(`[weapp-vite] resolving oxc helper via Rolldown plugin: ${helperName}`)
          return fs.readFile(helperPath, 'utf8')
        }
        const fallback = fallbackHelpers[helperName]
        if (fallback) {
          return fallback
        }
      }
      return null
    },
  }

  const vitePlugin: VitePlugin = {
    name: 'weapp-vite:oxc-runtime-helpers',
    enforce: 'pre',
    resolveId(source) {
      if (source.startsWith(NULL_BYTE)) {
        return null
      }
      if (source.includes('@oxc-project/runtime/helpers')) {
        logger.warn(`[weapp-vite] resolveId intercepted: ${source}`)
      }
      const helperName = getOxcHelperName(source)
      if (helperName) {
        return path.resolve(oxcRuntimeHelpersRoot, `${helperName}.js`)
      }
      return null
    },
    async load(id) {
      if (!id.startsWith(NULL_BYTE)) {
        return null
      }
      const helperName = getOxcHelperName(id)
      if (!helperName) {
        return null
      }
      const helperPath = path.resolve(oxcRuntimeHelpersRoot, `${helperName}.js`)
      logger.warn(`[weapp-vite] resolving oxc helper via Vite plugin: ${helperName}`)
      return fs.readFile(helperPath, 'utf8')
    },
  }

  return {
    alias,
    rolldownPlugin,
    vitePlugin,
  }
}
