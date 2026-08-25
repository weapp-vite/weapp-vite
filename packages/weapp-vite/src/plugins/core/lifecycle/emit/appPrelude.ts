import type { MiniProgramNetworkDefaults } from '@wevu/web-apis'
import type { OutputBundle, OutputChunk } from 'rolldown'
import type {
  WeappAppPreludeMode,
  WeappInjectRequestGlobalsTarget,
} from '../../../../types'
import type { ImportMetaDefineRegistry } from '../../../../utils/importMeta'
import type { CorePluginState } from '../../helpers'
import { readFile } from 'node:fs/promises'
import MagicString from 'magic-string'
import path from 'pathe'
import { transformWithOxc } from 'vite'
import { toPosixPath } from '../../../../utils'
import { parseJsLike, traverse } from '../../../../utils/babel'
import { changeFileExtension } from '../../../../utils/file'
import { applyMagicStringChunkRewrite } from '../../../../utils/outputChunk'
import { replaceImportMetaAccess } from '../transform/importMeta'
import {
  APP_PRELUDE_CHUNK_MARKER,
  APP_PRELUDE_GUARD_KEY,
  APP_PRELUDE_REQUIRE_FILE_BASENAME,
  APP_PRELUDE_REQUIRE_MARKER,
  DIRECTIVE_PROLOGUE_RE,
  REQUEST_GLOBAL_BUNDLE_MARKER,
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  USE_STRICT_PREFIX_RE,
} from './constants'
import {
  createRequestGlobalsPreludeAssetCode,
  createRequestGlobalsPreludeCode,
  resolveRequestGlobalsInstallerImport,
} from './requestGlobals'

interface ResolvedAppPreludeOptions {
  enabled: boolean
  mode: WeappAppPreludeMode
}

export function resolveAppPreludeOptions(state: CorePluginState): ResolvedAppPreludeOptions {
  const option = state.ctx.configService.weappViteConfig?.appPrelude
  if (option === false) {
    return { enabled: false, mode: 'require' }
  }
  if (option === true || option == null) {
    return { enabled: true, mode: 'require' }
  }
  return {
    enabled: option.enabled !== false,
    mode: option.mode ?? 'require',
  }
}

export function collectAppPreludeEntryChunkFileNames(state: CorePluginState) {
  const entryChunkFileNames = new Set<string>()
  for (const entry of state.entriesMap.values()) {
    if (!entry || (entry.type !== 'app' && entry.type !== 'page' && entry.type !== 'component')) {
      continue
    }
    const relative = state.ctx.configService.relativeAbsoluteSrcRoot(entry.path)
    entryChunkFileNames.add(changeFileExtension(relative, '.js'))
  }
  return entryChunkFileNames
}

export async function resolveAppPreludeCode(
  preludePath: string | undefined,
  options?: {
    importMetaDefineRegistry?: ImportMetaDefineRegistry
    relativePath?: string
  },
) {
  if (!preludePath) {
    return undefined
  }
  const source = await readFile(preludePath, 'utf8')
  if (!source.trim()) {
    return undefined
  }

  const ast = parseJsLike(source)
  let hasModuleSyntax = false
  traverse(ast as any, {
    ImportDeclaration() { hasModuleSyntax = true },
    ExportAllDeclaration() { hasModuleSyntax = true },
    ExportDefaultDeclaration() { hasModuleSyntax = true },
    ExportNamedDeclaration() { hasModuleSyntax = true },
  })
  if (hasModuleSyntax) {
    throw new Error('[app.prelude] 当前仅支持无 import/export 的自包含脚本。')
  }

  const transformed = await transformWithOxc(source, preludePath)
  const importMetaCode = options?.relativePath
    ? replaceImportMetaAccess(transformed.code, {
        importMetaDefineRegistry: options.importMetaDefineRegistry,
        extension: path.extname(preludePath),
        relativePath: options.relativePath,
      })
    : transformed.code
  const normalizedCode = importMetaCode.replace(USE_STRICT_PREFIX_RE, '').trim()
  if (!normalizedCode) {
    return undefined
  }

  return [
    `/* ${APP_PRELUDE_CHUNK_MARKER} */`,
    `(() => {`,
    `  if (globalThis[${JSON.stringify(APP_PRELUDE_GUARD_KEY)}]) {`,
    `    return`,
    `  }`,
    `  globalThis[${JSON.stringify(APP_PRELUDE_GUARD_KEY)}] = true`,
    normalizedCode,
    `})();`,
  ].join('\n')
}

export function resolveAppPreludeRequireFileName(fileName: string, state: CorePluginState) {
  const matchedIndependentRoot = state.subPackageMeta?.subPackage.root
  if (matchedIndependentRoot) {
    return `${matchedIndependentRoot}/${APP_PRELUDE_REQUIRE_FILE_BASENAME}`
  }
  const roots = [...(state.ctx.scanService.subPackageMap?.keys() ?? [])].filter(Boolean).sort((l, r) => r.length - l.length)
  const matchedRoot = roots.find(root => fileName === root || fileName.startsWith(`${root}/`))
  if (!matchedRoot) {
    return APP_PRELUDE_REQUIRE_FILE_BASENAME
  }
  return `${matchedRoot}/${APP_PRELUDE_REQUIRE_FILE_BASENAME}`
}

export function createAppPreludeRequireStatement(chunkFileName: string, preludeFileName: string) {
  const relativePath = toPosixPath(path.relative(path.dirname(chunkFileName), preludeFileName))
  const requestPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`
  return `/* ${APP_PRELUDE_REQUIRE_MARKER} */require(${JSON.stringify(requestPath)})`
}

function prependChunkCodeWithSourcemap(chunk: OutputChunk, injectedCode: string) {
  const directiveMatch = chunk.code.match(DIRECTIVE_PROLOGUE_RE)
  const insertIndex = directiveMatch?.[0] ? directiveMatch[0].length : 0
  const magicString = new MagicString(chunk.code)
  magicString.prependLeft(insertIndex, `${injectedCode}\n`)
  applyMagicStringChunkRewrite(chunk, magicString, { hires: true })
}

function hasRequestGlobalsPreludeDependency(
  chunk: OutputChunk,
  requestGlobalsPreludeOptions: {
    enabled: boolean
    installerChunks: Map<string, string>
  },
) {
  if (!requestGlobalsPreludeOptions.enabled) {
    return false
  }

  return requestGlobalsPreludeOptions.installerChunks.has(toPosixPath(chunk.fileName))
    || Boolean(resolveRequestGlobalsInstallerImport(chunk, requestGlobalsPreludeOptions.installerChunks))
    || chunk.code.includes(REQUEST_GLOBAL_BUNDLE_MARKER)
    || chunk.code.includes(REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER)
    || chunk.code.includes(REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER)
}

export function emitAppPreludeRequireAssets(
  bundle: OutputBundle,
  appPreludeCode: string | undefined,
  state: CorePluginState,
  requestGlobalsPreludeOptions: {
    enabled: boolean
    installerChunks: Map<string, string>
    mode: 'auto' | 'explicit'
    networkDefaults?: MiniProgramNetworkDefaults
    targets: WeappInjectRequestGlobalsTarget[]
  },
  emitFile?: (asset: { type: 'asset', fileName: string, source: string }) => void,
) {
  const preservedRequestGlobalsInstallerChunks = new Set<string>()
  if (!appPreludeCode && !requestGlobalsPreludeOptions.enabled) {
    return preservedRequestGlobalsInstallerChunks
  }
  const preludeFileNames = new Set<string>()
  if (state.subPackageMeta?.subPackage.root) {
    preludeFileNames.add(`${state.subPackageMeta.subPackage.root}/${APP_PRELUDE_REQUIRE_FILE_BASENAME}`)
  }
  else {
    preludeFileNames.add(APP_PRELUDE_REQUIRE_FILE_BASENAME)
    for (const root of state.ctx.scanService.subPackageMap.keys()) {
      if (root) {
        preludeFileNames.add(`${root}/${APP_PRELUDE_REQUIRE_FILE_BASENAME}`)
      }
    }
  }
  for (const fileName of preludeFileNames) {
    if (bundle[fileName]) {
      continue
    }
    const scopeChunks = Object.values(bundle).filter((output): output is OutputChunk => {
      return output?.type === 'chunk' && resolveAppPreludeRequireFileName(output.fileName, state) === fileName
    })
    const sortedScopeChunks = [
      ...scopeChunks.filter(chunk => !requestGlobalsPreludeOptions.installerChunks.has(toPosixPath(chunk.fileName))),
      ...scopeChunks.filter(chunk => requestGlobalsPreludeOptions.installerChunks.has(toPosixPath(chunk.fileName))),
    ]
    let requestGlobalsPreludeCode: string | undefined
    if (requestGlobalsPreludeOptions.enabled) {
      for (const chunk of sortedScopeChunks) {
        const code = createRequestGlobalsPreludeAssetCode(
          fileName,
          chunk,
          requestGlobalsPreludeOptions.installerChunks,
          requestGlobalsPreludeOptions.targets,
          requestGlobalsPreludeOptions.mode,
          requestGlobalsPreludeOptions.networkDefaults,
        )
        if (!code) {
          continue
        }
        requestGlobalsPreludeCode = code
        const installerImport = resolveRequestGlobalsInstallerImport(chunk, requestGlobalsPreludeOptions.installerChunks)
        const installerChunkFileName = installerImport?.installerChunkFileName
          ?? (requestGlobalsPreludeOptions.installerChunks.has(toPosixPath(chunk.fileName))
            ? toPosixPath(chunk.fileName)
            : undefined)
        if (installerChunkFileName) {
          preservedRequestGlobalsInstallerChunks.add(installerChunkFileName)
        }
        break
      }
    }
    const source = [requestGlobalsPreludeCode, appPreludeCode].filter(Boolean).join('\n')
    emitFile?.({ type: 'asset', fileName, source: `${source}\n` })
  }
  return preservedRequestGlobalsInstallerChunks
}

export function injectAppPreludeCode(
  bundle: OutputBundle,
  appPreludeCode: string | undefined,
  options: ResolvedAppPreludeOptions,
  state: CorePluginState,
  requestGlobalsPreludeOptions: {
    enabled: boolean
    installerChunks: Map<string, string>
    mode: 'auto' | 'explicit'
    networkDefaults?: MiniProgramNetworkDefaults
    targets: WeappInjectRequestGlobalsTarget[]
  },
  emitFile?: (asset: { type: 'asset', fileName: string, source: string }) => void,
) {
  let preservedRequestGlobalsInstallerChunks = new Set<string>()
  if (!options.enabled) {
    return preservedRequestGlobalsInstallerChunks
  }
  const entryChunkFileNames = options.mode === 'entry' ? collectAppPreludeEntryChunkFileNames(state) : undefined
  if (options.mode === 'require' && (appPreludeCode || requestGlobalsPreludeOptions.enabled)) {
    preservedRequestGlobalsInstallerChunks = emitAppPreludeRequireAssets(bundle, appPreludeCode, state, requestGlobalsPreludeOptions, emitFile)
  }
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (chunk.code.includes(APP_PRELUDE_CHUNK_MARKER) || chunk.code.includes(APP_PRELUDE_REQUIRE_MARKER)) {
      continue
    }
    const isTargetEntryChunk = chunk.isEntry === true || entryChunkFileNames?.has(chunk.fileName) === true
    if (entryChunkFileNames && !isTargetEntryChunk) {
      continue
    }
    const requestGlobalsPreludeCode = requestGlobalsPreludeOptions.enabled && options.mode !== 'require'
      ? createRequestGlobalsPreludeCode(
          chunk,
          requestGlobalsPreludeOptions.installerChunks,
          requestGlobalsPreludeOptions.targets,
          requestGlobalsPreludeOptions.mode,
          requestGlobalsPreludeOptions.networkDefaults,
        )
      : undefined
    const shouldInjectRequirePrelude = appPreludeCode
      || hasRequestGlobalsPreludeDependency(chunk, requestGlobalsPreludeOptions)
    const injectedCode = [
      requestGlobalsPreludeCode,
      options.mode === 'require'
        ? shouldInjectRequirePrelude
          ? createAppPreludeRequireStatement(chunk.fileName, resolveAppPreludeRequireFileName(chunk.fileName, state))
          : undefined
        : appPreludeCode,
    ].filter(Boolean).join('\n')
    if (!injectedCode) {
      continue
    }
    prependChunkCodeWithSourcemap(chunk, injectedCode)
  }
  return preservedRequestGlobalsInstallerChunks
}
