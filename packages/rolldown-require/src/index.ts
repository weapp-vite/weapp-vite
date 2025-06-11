import type { GetOutputFile, InternalOptions, Options, RequireFunction } from './types'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { getTsconfig } from 'get-tsconfig'
import { type OutputChunk, rolldown } from 'rolldown'
import { findNearestNodeModules } from './packages'
import { tryNodeResolve } from './plugins/resolve'
import { dynamicImport, isFilePathESM, isNodeBuiltin, isNodeLikeBuiltin, nodeLikeBuiltins } from './utils'

interface NodeModuleWithCompile extends NodeModule {
  _compile: (code: string, filename: string) => any
}

const promisifiedRealpath = promisify(fs.realpath)
// inferred ones are omitted
export const configDefaults = Object.freeze({
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
})

// export const JS_EXT_RE = /\.([mc]?[tj]s|[tj]sx)$/
// Use a random path to avoid import cache
const defaultGetOutputFile: GetOutputFile = (filepath, _format) => {
  return filepath
}

function collectAllModules(
  bundle: Record<string, OutputChunk>,
  fileName: string,
  allModules: Set<string>,
  analyzedModules = new Set<string>(),
) {
  if (analyzedModules.has(fileName)) {
    return
  }
  analyzedModules.add(fileName)

  const chunk = bundle[fileName]!
  for (const mod of chunk.moduleIds) {
    allModules.add(mod)
  }
  for (const i of chunk.imports) {
    analyzedModules.add(i)
    collectAllModules(bundle, i, allModules, analyzedModules)
  }
  for (const i of chunk.dynamicImports) {
    analyzedModules.add(i)
    collectAllModules(bundle, i, allModules, analyzedModules)
  }
}

export async function bundleFile(
  fileName: string,
  options: InternalOptions,
): Promise<{ code: string, dependencies: string[] }> {
  const { isESM } = options
  const isModuleSyncConditionEnabled = (await import(
    // @ts-ignore
    '#module-sync-enabled'
  ))
    .default

  const dirnameVarName = '__vite_injected_original_dirname'
  const filenameVarName = '__vite_injected_original_filename'
  const importMetaUrlVarName = '__vite_injected_original_import_meta_url'
  const rolldownInputOptions = options?.rolldownOptions?.input || {}
  const bundle = await rolldown({
    ...rolldownInputOptions,
    input: fileName,
    // target: [`node${process.versions.node}`],
    platform: 'node',
    resolve: {
      mainFields: ['main'],
      tsconfigFilename: options.tsconfig,
    },
    define: {
      '__dirname': dirnameVarName,
      '__filename': filenameVarName,
      'import.meta.url': importMetaUrlVarName,
      'import.meta.dirname': dirnameVarName,
      'import.meta.filename': filenameVarName,
    },
    // disable treeshake to include files that is not sideeffectful to `moduleIds`
    treeshake: false,
    plugins: [
      (() => {
        const packageCache = new Map()
        const resolveByViteResolver = (
          id: string,
          importer: string,
          isRequire: boolean,
        ) => {
          return tryNodeResolve(id, importer, {
            root: path.dirname(fileName),
            isBuild: true,
            isProduction: true,
            preferRelative: false,
            tryIndex: true,
            mainFields: [],
            conditions: [
              'node',
              ...(isModuleSyncConditionEnabled ? ['module-sync'] : []),
            ],
            externalConditions: [],
            external: [],
            noExternal: [],
            dedupe: [],
            extensions: configDefaults.resolve.extensions,
            preserveSymlinks: false,
            packageCache,
            isRequire,
            builtins: nodeLikeBuiltins,
          })?.id
        }

        return {
          name: 'externalize-deps',
          resolveId: {
            filter: { id: /^[^.#].*/ },
            async handler(id, importer, { kind }) {
              if (!importer || path.isAbsolute(id) || isNodeBuiltin(id)) {
                return
              }

              // With the `isNodeBuiltin` check above, this check captures if the builtin is a
              // non-node built-in, which esbuild doesn't know how to handle. In that case, we
              // externalize it so the non-node runtime handles it instead.
              if (isNodeLikeBuiltin(id)) {
                return { id, external: true }
              }

              const isImport = isESM || kind === 'dynamic-import'
              let idFsPath: string | undefined
              try {
                idFsPath = resolveByViteResolver(id, importer, !isImport)
              }
              catch (e) {
                if (!isImport) {
                  let canResolveWithImport = false
                  try {
                    canResolveWithImport = !!resolveByViteResolver(
                      id,
                      importer,
                      false,
                    )
                  }
                  catch { }
                  if (canResolveWithImport) {
                    throw new Error(
                      `Failed to resolve ${JSON.stringify(
                        id,
                      )}. This package is ESM only but it was tried to load by \`require\`. See https://vite.dev/guide/troubleshooting.html#this-package-is-esm-only for more details.`,
                    )
                  }
                }
                throw e
              }
              if (!idFsPath) {
                return
              }
              // always no-externalize json files as rolldown does not support import attributes
              if (idFsPath.endsWith('.json')) {
                return idFsPath
              }

              if (idFsPath && isImport) {
                idFsPath = pathToFileURL(idFsPath).href
              }
              return { id: idFsPath, external: true }
            },
          },
        }
      })(),
      {
        name: 'inject-file-scope-variables',
        transform: {
          filter: { id: /\.[cm]?[jt]s$/ },
          async handler(code, id) {
            const injectValues
              = `const ${dirnameVarName} = ${JSON.stringify(path.dirname(id))};`
                + `const ${filenameVarName} = ${JSON.stringify(id)};`
                + `const ${importMetaUrlVarName} = ${JSON.stringify(
                  pathToFileURL(id).href,
                )};`
            return { code: injectValues + code, map: null }
          },
        },
      },
    ],
    external: options.external,
    // preserveEntrySignatures: 'exports-only'
  })

  const rolldownOutputOptions = options?.rolldownOptions?.output || {}
  const result = await bundle.generate({
    ...rolldownOutputOptions,
    format: options.format,
    sourcemap: false,
    // sourcemapPathTransform(relative) {
    //   return path.resolve(fileName, relative)
    // },
    // we want to generate a single chunk like esbuild does with `splitting: false`
    inlineDynamicImports: true,
  })
  await bundle.close()

  const entryChunk = result.output.find(
    (chunk): chunk is OutputChunk => chunk.type === 'chunk' && chunk.isEntry,
  )!
  const bundleChunks = Object.fromEntries(
    result.output.flatMap(c => (c.type === 'chunk' ? [[c.fileName, c]] : [])),
  )

  const allModules = new Set<string>()
  collectAllModules(bundleChunks, entryChunk.fileName, allModules)
  allModules.delete(fileName)

  return {
    code: entryChunk.code,
    dependencies: [...allModules],
  }
}

const _require = createRequire(import.meta.url)

export async function loadFromBundledFile(
  fileName: string,
  bundledCode: string,
  options: InternalOptions,
): Promise<any> {
  const { isESM } = options
  // for esm, before we can register loaders without requiring users to run node
  // with --experimental-loader themselves, we have to do a hack here:
  // write it to disk, load it with native Node ESM, then delete the file.
  if (isESM) {
    // Storing the bundled file in node_modules/ is avoided for Deno
    // because Deno only supports Node.js style modules under node_modules/
    // and configs with `npm:` import statements will fail when executed.
    let nodeModulesDir
      = typeof process.versions.deno === 'string'
        ? undefined
        : findNearestNodeModules(path.dirname(fileName))
    if (nodeModulesDir) {
      try {
        await fsp.mkdir(path.resolve(nodeModulesDir, '.vite-temp/'), {
          recursive: true,
        })
      }
      catch (e) {
        // @ts-ignore
        if (e.code === 'EACCES') {
          // If there is no access permission, a temporary configuration file is created by default.
          nodeModulesDir = undefined
        }
        else {
          throw e
        }
      }
    }
    const hash = `timestamp-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const tempFileName = nodeModulesDir
      ? path.resolve(
          nodeModulesDir,
          `.vite-temp/${path.basename(fileName)}.${hash}.${isESM ? 'mjs' : 'cjs'}`,
        )
      : `${fileName}.${hash}.mjs`

    const getOutputFile = options.getOutputFile || defaultGetOutputFile
    const outfile = getOutputFile(tempFileName, options.format)
    // await options?.getOutputFile(tempFileName,)
    await fsp.writeFile(outfile, bundledCode)
    let mod: any
    const req: RequireFunction = options.require || dynamicImport
    try {
      mod = await req(
        options.format === 'esm' ? pathToFileURL(outfile).href : outfile,
        { format: options.format },
      )
      return mod
    }
    finally {
      if (!options?.preserveTemporaryFile) {
        fs.unlink(outfile, () => { }) // Ignore errors
      }
    }
  }
  // for cjs, we can register a custom loader via `_require.extensions`
  else {
    const extension = path.extname(fileName)
    // We don't use fsp.realpath() here because it has the same behaviour as
    // fs.realpath.native. On some Windows systems, it returns uppercase volume
    // letters (e.g. "C:\") while the Node.js loader uses lowercase volume letters.
    // See https://github.com/vitejs/vite/issues/12923
    const realFileName = await promisifiedRealpath(fileName)
    const loaderExt = extension in _require.extensions ? extension : '.js'
    const defaultLoader = _require.extensions[loaderExt]!
    _require.extensions[loaderExt] = (module: NodeModule, filename: string) => {
      if (filename === realFileName) {
        ; (module as NodeModuleWithCompile)._compile(bundledCode, filename)
      }
      else {
        defaultLoader(module, filename)
      }
    }
    // clear cache in case of server restart
    delete _require.cache[_require.resolve(fileName)]
    const raw = _require(fileName)
    _require.extensions[loaderExt] = defaultLoader
    return raw.__esModule ? raw.default : raw
  }
}

export async function bundleRequire<T = any>(options: Options): Promise<{
  mod: T
  dependencies: string[]
}> {
  const resolvedPath = path.isAbsolute(options.filepath) ? options.filepath : path.resolve(options.cwd || process.cwd(), options.filepath)
  const isESM
    = typeof process.versions.deno === 'string' || isFilePathESM(resolvedPath)

  if (options.tsconfig !== false) {
    options.tsconfig = options.tsconfig ?? getTsconfig(options.cwd, 'tsconfig.json')?.path ?? undefined
  }
  else {
    options.tsconfig = undefined
  }

  if (!options.format) {
    options.format = isESM ? 'esm' : 'cjs'
  }
  const internalOptions: InternalOptions = {
    ...options,
    isESM,
    format: options.format,
    tsconfig: options.tsconfig,
  }

  const bundled = await bundleFile(
    resolvedPath,
    internalOptions,
  )
  const mod = await loadFromBundledFile(
    resolvedPath,
    bundled.code,
    internalOptions,
  )

  return {
    mod,
    dependencies: bundled.dependencies,
  }
}
