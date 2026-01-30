import type { InputOptions, OutputChunk, OutputOptions } from 'rolldown'
import type { InternalOptions } from './types'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import { collectReferencedModules } from './collect'
import { createExternalizeDepsPlugin } from './externalize'
import { getModuleSyncConditionEnabled } from './module-sync'

export async function bundleFile(
  fileName: string,
  options: InternalOptions,
): Promise<{ code: string, dependencies: string[] }> {
  const { isESM } = options

  const dirnameVarName = '__vite_injected_original_dirname'
  const filenameVarName = '__vite_injected_original_filename'
  const importMetaUrlVarName = '__vite_injected_original_import_meta_url'
  const rolldownInputOptions = options?.rolldownOptions?.input || {}
  const {
    transform: userTransform,
    resolve: userResolve,
    ...restRolldownInputOptions
  } = rolldownInputOptions as InputOptions

  const transformDefine = {
    ...((userTransform as any)?.define ?? {}),
    '__dirname': dirnameVarName,
    '__filename': filenameVarName,
    'import.meta.url': importMetaUrlVarName,
    'import.meta.dirname': dirnameVarName,
    'import.meta.filename': filenameVarName,
  }
  const transformOptions = {
    ...(userTransform ?? {}),
    define: transformDefine,
  }

  const moduleSyncEnabled = await getModuleSyncConditionEnabled()
  const userConditionNames = userResolve?.conditionNames as string[] | undefined
  const conditionNames = [...(userConditionNames ?? [])]
  if (moduleSyncEnabled && !conditionNames.includes('module-sync')) {
    conditionNames.push('module-sync')
  }
  const resolveOptions = {
    ...(userResolve ?? {}),
    mainFields: ['main'],
    ...(typeof options.tsconfig === 'string'
      ? { tsconfigFilename: options.tsconfig }
      : {}),
    ...(conditionNames.length ? { conditionNames } : {}),
  }

  /* eslint-disable no-console */
  const originalConsoleWarn = console.warn
  console.warn = (...args: any[]) => {
    const message = typeof args[0] === 'string' ? args[0] : ''
    if (
      message.includes('resolve.tsconfigFilename')
      || message.includes('Invalid input options')
      || message.includes('top-level "define" option is deprecated')
    ) {
      return
    }
    originalConsoleWarn(...args)
  }

  let bundle: Awaited<ReturnType<typeof rolldown>>
  try {
    bundle = await rolldown({
      ...restRolldownInputOptions,
      input: fileName,
      platform: 'node',
      ...(options.tsconfig !== undefined ? { tsconfig: options.tsconfig } : {}),
      resolve: resolveOptions,
      // @ts-ignore
      define: transformDefine,
      transform: transformOptions as any,
      // disable treeshake to include files that is not sideeffectful to `moduleIds`
      treeshake: false,
      plugins: [
        createExternalizeDepsPlugin({
          entryFile: fileName,
          isESM,
        }),
        createFileScopeVariablesPlugin({
          dirnameVarName,
          filenameVarName,
          importMetaUrlVarName,
        }),
      ],
      external: options.external,
    })
  }
  finally {
    console.warn = originalConsoleWarn
  }
  /* eslint-enable no-console */

  if (!bundle) {
    throw new Error('Failed to initialize bundler')
  }

  const rolldownOutputOptions = options?.rolldownOptions?.output || {}
  const { codeSplitting: _codeSplitting, ...normalizedOutputOptions } = rolldownOutputOptions as OutputOptions & {
    codeSplitting?: unknown
  }
  const result = await bundle.generate({
    ...normalizedOutputOptions,
    format: options.format,
    sourcemap: resolveSourcemapOutput(normalizedOutputOptions.sourcemap, options.sourcemap),
    codeSplitting: false,
  })
  await bundle.close()

  const entryChunk = result.output.find(
    (chunk): chunk is OutputChunk => chunk.type === 'chunk' && chunk.isEntry,
  )!
  const bundleChunks = Object.fromEntries(
    result.output.flatMap(c => (c.type === 'chunk' ? [[c.fileName, c]] : [])),
  )

  const allModules = new Set<string>()
  collectReferencedModules(bundleChunks, entryChunk.fileName, allModules)
  allModules.delete(fileName)

  return {
    code: entryChunk.code,
    dependencies: [...allModules],
  }
}

function resolveSourcemapOutput(
  outputSourcemap: OutputOptions['sourcemap'],
  requested: InternalOptions['sourcemap'],
): OutputOptions['sourcemap'] {
  if (outputSourcemap !== undefined) {
    return outputSourcemap
  }
  if (requested === true) {
    return 'inline'
  }
  return requested ?? false
}

function createFileScopeVariablesPlugin({
  dirnameVarName,
  filenameVarName,
  importMetaUrlVarName,
}: {
  dirnameVarName: string
  filenameVarName: string
  importMetaUrlVarName: string
}) {
  return {
    name: 'inject-file-scope-variables',
    transform: {
      filter: { id: /\.[cm]?[jt]s$/ },
      async handler(code: string, id: string) {
        const injectValues
          = `const ${dirnameVarName} = ${JSON.stringify(path.dirname(id))};`
            + `const ${filenameVarName} = ${JSON.stringify(id)};`
            + `const ${importMetaUrlVarName} = ${JSON.stringify(
              pathToFileURL(id).href,
            )};`
        return { code: injectValues + code, map: null }
      },
    },
  }
}
