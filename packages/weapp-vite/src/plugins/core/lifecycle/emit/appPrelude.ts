import type { OutputBundle, OutputChunk } from 'rolldown'
import type { WeappAppPreludeMode, WeappInjectRequestGlobalsTarget } from '../../../../types'
import type { CorePluginState } from '../../helpers'
import { readFile } from 'node:fs/promises'
import path from 'pathe'
import { transformWithOxc } from 'vite'
import { toPosixPath } from '../../../../utils'
import { parseJsLike, traverse } from '../../../../utils/babel'
import { changeFileExtension } from '../../../../utils/file'
import { replaceImportMetaAccess } from '../transform/importMeta'
import {
  APP_PRELUDE_CHUNK_MARKER,
  APP_PRELUDE_GUARD_KEY,
  APP_PRELUDE_REQUIRE_FILE_BASENAME,
  APP_PRELUDE_REQUIRE_MARKER,
  USE_STRICT_PREFIX_RE,
} from './constants'
import { createRequestGlobalsPreludeCode } from './requestGlobals'
import { prependChunkCodePreservingDirectives } from './rewrite'

interface ResolvedAppPreludeOptions {
  enabled: boolean
  mode: WeappAppPreludeMode
}

export function resolveAppPreludeOptions(state: CorePluginState): ResolvedAppPreludeOptions {
  const option = state.ctx.configService.weappViteConfig?.appPrelude
  if (option === false) {
    return { enabled: false, mode: 'entry' }
  }
  if (option === true || option == null) {
    return { enabled: true, mode: 'entry' }
  }
  return {
    enabled: option.enabled !== false,
    mode: option.mode ?? 'entry',
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
    defineImportMetaEnv?: Record<string, any>
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
        defineImportMetaEnv: options.defineImportMetaEnv,
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

export function emitAppPreludeRequireAssets(
  bundle: OutputBundle,
  appPreludeCode: string | undefined,
  state: CorePluginState,
  emitFile?: (asset: { type: 'asset', fileName: string, source: string }) => void,
) {
  if (!appPreludeCode) {
    return
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
    emitFile?.({ type: 'asset', fileName, source: `${appPreludeCode}\n` })
  }
}

export function injectAppPreludeCode(
  bundle: OutputBundle,
  appPreludeCode: string | undefined,
  options: ResolvedAppPreludeOptions,
  state: CorePluginState,
  requestGlobalsPreludeOptions: {
    enabled: boolean
    installerChunks: Map<string, string>
    targets: WeappInjectRequestGlobalsTarget[]
  },
  emitFile?: (asset: { type: 'asset', fileName: string, source: string }) => void,
) {
  if (!options.enabled) {
    return
  }
  const entryChunkFileNames = options.mode === 'entry' ? collectAppPreludeEntryChunkFileNames(state) : undefined
  if (options.mode === 'require' && appPreludeCode) {
    emitAppPreludeRequireAssets(bundle, appPreludeCode, state, emitFile)
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
    const requestGlobalsPreludeCode = requestGlobalsPreludeOptions.enabled
      ? createRequestGlobalsPreludeCode(chunk, requestGlobalsPreludeOptions.installerChunks, requestGlobalsPreludeOptions.targets)
      : undefined
    const injectedCode = [
      requestGlobalsPreludeCode,
      options.mode === 'require'
        ? appPreludeCode
          ? createAppPreludeRequireStatement(chunk.fileName, resolveAppPreludeRequireFileName(chunk.fileName, state))
          : undefined
        : appPreludeCode,
    ].filter(Boolean).join('\n')
    if (!injectedCode) {
      continue
    }
    chunk.code = prependChunkCodePreservingDirectives(chunk.code, injectedCode)
  }
}
