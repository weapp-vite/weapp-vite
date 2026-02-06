import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import { isBuiltin } from 'node:module'
import process from 'node:process'
import * as t from '@babel/types'
import { defu, isObject } from '@weapp-core/shared'
import fs from 'fs-extra'
import { getPackageInfo, resolveModule } from 'local-pkg'
import path from 'pathe'
import { build as viteBuild } from 'vite'
import { logger } from '../../context/shared'
import { generate, parseJsLike, traverse } from '../../utils'

export interface PackageBuilder {
  isMiniprogramPackage: (pkg: PackageJson) => boolean
  shouldSkipBuild: (outDir: string, isOutdated: boolean) => Promise<boolean>
  bundleBuild: (args: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) => Promise<void>
  copyBuild: (args: { from: string, to: string, name: string }) => Promise<void>
  buildPackage: (args: { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean }) => Promise<void>
}

const ALIPAY_EXTENSION_MAP: Record<string, string> = {
  '.wxml': '.axml',
  '.wxss': '.acss',
  '.wxs': '.sjs',
}

const ALIPAY_TEXT_FILE_EXTENSIONS = new Set([
  '.js',
  '.json',
  '.axml',
  '.acss',
  '.sjs',
  '.wxml',
  '.wxss',
  '.wxs',
])

async function collectFiles(root: string) {
  const files: string[] = []
  const stack = [root]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const filePath = path.resolve(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(filePath)
      }
      else if (entry.isFile()) {
        files.push(filePath)
      }
    }
  }

  return files
}

async function shouldRebuildCachedAlipayMiniprogramPackage(pkgRoot: string, outDir: string) {
  if (!(await fs.pathExists(pkgRoot))) {
    return true
  }

  const files = await collectFiles(pkgRoot)
  for (const filePath of files) {
    const ext = path.extname(filePath)
    if (ext === '.wxml' || ext === '.wxss' || ext === '.wxs') {
      return true
    }

    if (!ALIPAY_TEXT_FILE_EXTENSIONS.has(ext)) {
      continue
    }

    let source = ''
    try {
      source = await fs.readFile(filePath, 'utf8')
    }
    catch {
      continue
    }

    if (/\.wxml\b|\.wxss\b|\.wxs\b/.test(source)) {
      return true
    }

    if (ext === '.js' && (/\bimport\s|\bexport\s/.test(source) || /\?\?/.test(source))) {
      return true
    }

    if ((ext === '.axml' || ext === '.wxml') && (/\bwx:(?:if|elif|else|for|for-item|for-index|key)\b/.test(source) || /<\s*(?:\/\s*)?wxs\b/.test(source) || /\selse(?=[\s/>])/.test(source))) {
      return true
    }
  }

  const nestedRoot = path.resolve(pkgRoot, 'miniprogram_npm')
  if (!(await fs.pathExists(nestedRoot))) {
    return false
  }

  const entries = await fs.readdir(nestedRoot)
  for (const name of entries) {
    const target = path.resolve(outDir, name)
    if (!(await fs.pathExists(target))) {
      return true
    }
  }

  return false
}

function hasEsmSyntax(source: string) {
  return /\bimport\s|\bexport\s/.test(source)
}

function rewriteAlipayWxmlSyntax(source: string) {
  return source
    .replace(/\bwx:(if|elif|else|for|for-item|for-index|key)\b/g, (_, directive: string) => `a:${directive}`)
    .replace(/<\s*\/\s*wxs\b/g, '</import-sjs')
    .replace(/<\s*wxs\b/g, '<import-sjs')
    .replace(/<import-sjs([\s\S]*?)>/g, (tag) => {
      return tag
        .replace(/\bsrc\s*=\s*/g, 'from=')
        .replace(/\bmodule\s*=\s*/g, 'name=')
    })
    .replace(/\selse(?=[\s/>])/g, ' a:else')
}

function rewriteAlipayExtensionReferences(source: string) {
  return source
    .replace(/\.wxml\b/g, '.axml')
    .replace(/\.wxss\b/g, '.acss')
    .replace(/\.wxs\b/g, '.sjs')
}

function transformWxmlToAxmlForAlipay(source: string) {
  return rewriteAlipayWxmlSyntax(source)
}

function createExportsMember(name: string) {
  return t.memberExpression(
    t.identifier('exports'),
    t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name),
    !t.isValidIdentifier(name),
  )
}

function createExportsAssignment(name: string, value: t.Expression) {
  return t.expressionStatement(
    t.assignmentExpression(
      '=',
      createExportsMember(name),
      value,
    ),
  )
}

function createRequireMemberExpression(base: t.Identifier, name: string) {
  return t.memberExpression(
    base,
    t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name),
    !t.isValidIdentifier(name),
  )
}

async function transformJsModuleToCjsForAlipay(source: string) {
  if (!hasEsmSyntax(source)) {
    return source
  }

  try {
    const ast = parseJsLike(source)
    let transformed = false
    const exportAssignments: t.Statement[] = []

    traverse(ast as any, {
      ImportDeclaration(path: any) {
        const sourceLiteral = t.stringLiteral(path.node.source.value)
        const specifiers = path.node.specifiers ?? []
        if (specifiers.length === 0) {
          path.replaceWith(
            t.expressionStatement(
              t.callExpression(t.identifier('require'), [sourceLiteral]),
            ),
          )
          transformed = true
          return
        }

        const requireId = path.scope.generateUidIdentifier('imported')
        const statements: t.Statement[] = [
          t.variableDeclaration('const', [
            t.variableDeclarator(
              requireId,
              t.callExpression(t.identifier('require'), [sourceLiteral]),
            ),
          ]),
        ]

        for (const specifier of specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            statements.push(
              t.variableDeclaration('const', [
                t.variableDeclarator(
                  specifier.local,
                  t.conditionalExpression(
                    t.binaryExpression(
                      '!==',
                      createRequireMemberExpression(requireId, 'default'),
                      t.identifier('undefined'),
                    ),
                    createRequireMemberExpression(requireId, 'default'),
                    requireId,
                  ),
                ),
              ]),
            )
            continue
          }

          if (t.isImportNamespaceSpecifier(specifier)) {
            statements.push(
              t.variableDeclaration('const', [
                t.variableDeclarator(specifier.local, requireId),
              ]),
            )
            continue
          }

          const importedName = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value
          statements.push(
            t.variableDeclaration('const', [
              t.variableDeclarator(
                specifier.local,
                createRequireMemberExpression(requireId, importedName),
              ),
            ]),
          )
        }

        path.replaceWithMultiple(statements)
        transformed = true
      },

      ExportDefaultDeclaration(path: any) {
        const declaration = path.node.declaration

        if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) {
          let targetId = declaration.id
          if (!targetId) {
            targetId = path.scope.generateUidIdentifier('defaultExport')
            declaration.id = targetId
          }
          path.replaceWith(declaration)
          exportAssignments.push(createExportsAssignment('default', targetId))
          transformed = true
          return
        }

        const targetId = path.scope.generateUidIdentifier('defaultExport')
        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(targetId, declaration),
          ]),
        )
        exportAssignments.push(createExportsAssignment('default', targetId))
        transformed = true
      },

      ExportNamedDeclaration(path: any) {
        const declaration = path.node.declaration
        if (declaration) {
          path.replaceWith(declaration)
          const names = Object.keys(t.getBindingIdentifiers(declaration))
          for (const name of names) {
            exportAssignments.push(createExportsAssignment(name, t.identifier(name)))
          }
          transformed = true
          return
        }

        const specifiers = path.node.specifiers ?? []
        if (specifiers.length === 0) {
          path.remove()
          transformed = true
          return
        }

        if (path.node.source) {
          const requireId = path.scope.generateUidIdentifier('reExported')
          const statements: t.Statement[] = [
            t.variableDeclaration('const', [
              t.variableDeclarator(
                requireId,
                t.callExpression(t.identifier('require'), [t.stringLiteral(path.node.source.value)]),
              ),
            ]),
          ]
          for (const specifier of specifiers) {
            if (!t.isExportSpecifier(specifier)) {
              continue
            }
            const localName = t.isIdentifier(specifier.local) ? specifier.local.name : specifier.local.value
            const exportedName = t.isIdentifier(specifier.exported) ? specifier.exported.name : specifier.exported.value
            statements.push(createExportsAssignment(exportedName, createRequireMemberExpression(requireId, localName)))
          }
          path.replaceWithMultiple(statements)
          transformed = true
          return
        }

        const statements: t.Statement[] = []
        for (const specifier of specifiers) {
          if (!t.isExportSpecifier(specifier)) {
            continue
          }
          const localName = t.isIdentifier(specifier.local) ? specifier.local.name : specifier.local.value
          const exportedName = t.isIdentifier(specifier.exported) ? specifier.exported.name : specifier.exported.value
          statements.push(createExportsAssignment(exportedName, t.identifier(localName)))
        }

        path.replaceWithMultiple(statements)
        transformed = true
      },
    })

    if (exportAssignments.length > 0) {
      ast.program.body.push(...exportAssignments)
      transformed = true
    }

    if (!transformed) {
      return source
    }

    return generate(ast as any).code
  }
  catch {
    return source
  }
}

export async function normalizeMiniprogramPackageForAlipay(pkgRoot: string) {
  if (!(await fs.pathExists(pkgRoot))) {
    return
  }

  const initialFiles = await collectFiles(pkgRoot)
  const renameTasks = initialFiles
    .map((filePath) => {
      const ext = path.extname(filePath)
      const nextExt = ALIPAY_EXTENSION_MAP[ext]
      if (!nextExt) {
        return null
      }
      return {
        from: filePath,
        to: `${filePath.slice(0, -ext.length)}${nextExt}`,
      }
    })
    .filter((item): item is { from: string, to: string } => item !== null)

  for (const task of renameTasks) {
    if (task.from === task.to) {
      continue
    }
    await fs.move(task.from, task.to, { overwrite: true })
  }

  const normalizedFiles = await collectFiles(pkgRoot)
  for (const filePath of normalizedFiles) {
    const ext = path.extname(filePath)
    if (!ALIPAY_TEXT_FILE_EXTENSIONS.has(ext)) {
      continue
    }

    const source = await fs.readFile(filePath, 'utf8')
    let nextSource = source

    if (ext === '.js') {
      nextSource = await transformJsModuleToCjsForAlipay(nextSource)
    }

    if (ext === '.axml' || ext === '.wxml') {
      nextSource = transformWxmlToAxmlForAlipay(nextSource)
    }

    nextSource = rewriteAlipayExtensionReferences(nextSource)

    if (nextSource !== source) {
      await fs.writeFile(filePath, nextSource)
    }
  }
}

export async function hoistNestedMiniprogramDependenciesForAlipay(pkgRoot: string, outDir: string) {
  const nestedRoot = path.resolve(pkgRoot, 'miniprogram_npm')
  if (!(await fs.pathExists(nestedRoot))) {
    return
  }

  const entries = await fs.readdir(nestedRoot)
  for (const name of entries) {
    const source = path.resolve(nestedRoot, name)
    const target = path.resolve(outDir, name)

    if (await fs.pathExists(target)) {
      continue
    }

    await fs.copy(source, target, {
      overwrite: false,
      errorOnExist: false,
    })

    await normalizeMiniprogramPackageForAlipay(target)
  }
}

export function createPackageBuilder(
  ctx: MutableCompilerContext,
  oxcVitePlugin?: Plugin,
): PackageBuilder {
  const npmLogger = typeof logger.withTag === 'function' ? logger.withTag('npm') : logger

  function isMiniprogramPackage(pkg: PackageJson) {
    return Reflect.has(pkg, 'miniprogram') && typeof pkg.miniprogram === 'string'
  }

  async function shouldSkipBuild(outDir: string, isOutdated: boolean) {
    return !isOutdated && await fs.pathExists(outDir)
  }

  async function bundleBuild({ entry, name, options, outDir }: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) {
    const mergedOptions: NpmBuildOptions = defu<NpmBuildOptions, NpmBuildOptions[]>(options, {
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      root: ctx.configService?.cwd ?? process.cwd(),
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      plugins: [],
      build: {
        lib: {
          entry,
          formats: ['cjs'],
          fileName: (_format, entryName) => `${entryName}.js`,
        },
        outDir,
        emptyOutDir: true,
        sourcemap: false,
        minify: true,
        target: 'es6',
        rolldownOptions: {
          external: [],
          output: {
            exports: 'named',
          },
        },
      },
    })
    const resolvedOptions = ctx.configService?.weappViteConfig?.npm?.buildOptions?.(
      mergedOptions,
      { name, entry },
    )
    let finalOptions: NpmBuildOptions | undefined
    if (resolvedOptions === undefined) {
      finalOptions = mergedOptions
    }
    else if (isObject(resolvedOptions)) {
      finalOptions = resolvedOptions
    }
    if (finalOptions) {
      if (oxcVitePlugin) {
        const toPluginArray = (plugins: NpmBuildOptions['plugins']): Plugin[] => {
          const queue: unknown[] = []
          const result: Plugin[] = []
          if (plugins) {
            queue.push(plugins)
          }
          while (queue.length > 0) {
            const current = queue.shift()
            if (!current) {
              continue
            }
            if (Array.isArray(current)) {
              queue.unshift(...current)
              continue
            }
            result.push(current as Plugin)
          }
          return result
        }
        const existing = toPluginArray(finalOptions.plugins)
        const hasPlugin = existing.includes(oxcVitePlugin)
        const nextPlugins = hasPlugin ? existing : [oxcVitePlugin, ...existing]
        finalOptions.plugins = nextPlugins
      }

      await viteBuild(finalOptions)
    }
  }

  async function copyBuild({ from, to }: { from: string, to: string, name: string }) {
    await fs.copy(
      from,
      to,
    )
  }

  async function buildPackage(
    { dep, outDir, options, isDependenciesCacheOutdate }:
    { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean },
  ) {
    const packageInfo = await getPackageInfo(dep)
    if (!packageInfo || !ctx.configService) {
      return
    }
    const { packageJson: targetJson, rootPath } = packageInfo
    const dependencies = targetJson.dependencies ?? {}
    const keys = Object.keys(dependencies)
    const destOutDir = path.resolve(outDir, dep)
    if (isMiniprogramPackage(targetJson)) {
      if (await shouldSkipBuild(destOutDir, isDependenciesCacheOutdate)) {
        const shouldRebuildAlipayPackage = ctx.configService.platform === 'alipay'
          ? await shouldRebuildCachedAlipayMiniprogramPackage(destOutDir, outDir)
          : false
        if (!shouldRebuildAlipayPackage) {
          npmLogger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
          return
        }
      }
      await copyBuild({
        from: path.resolve(
          rootPath,
          targetJson.miniprogram,
        ),
        to: destOutDir,
        name: dep,
      })

      if (ctx.configService.platform === 'alipay') {
        await normalizeMiniprogramPackageForAlipay(destOutDir)
        await hoistNestedMiniprogramDependenciesForAlipay(destOutDir, outDir)
      }

      if (keys.length > 0) {
        await Promise.all(
          keys.map((x) => {
            return buildPackage({
              dep: x,
              outDir,
              options,
              isDependenciesCacheOutdate,
            })
          }),
        )
      }
    }
    else {
      const index = resolveModule(dep)
      if (!index) {
        npmLogger.warn(`[npm] 无法解析模块 \`${dep}\`，跳过处理!`)
        return
      }
      if (!isDependenciesCacheOutdate && await fs.pathExists(destOutDir)) {
        const destEntry = path.resolve(destOutDir, 'index.js')
        if (await fs.pathExists(destEntry)) {
          const [srcStat, destStat] = await Promise.all([fs.stat(index), fs.stat(destEntry)])
          if (srcStat.mtimeMs <= destStat.mtimeMs) {
            npmLogger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
            return
          }
        }
      }
      await bundleBuild({
        entry: {
          index,
        },
        name: dep,
        options,
        outDir: destOutDir,
      })
      if (keys.length > 0) {
        await Promise.all(
          keys.filter(x => isBuiltin(x)).map((x) => {
            return buildPackage({
              dep: `${x}/`,
              outDir,
              options,
              isDependenciesCacheOutdate,
            })
          }),
        )
      }
    }

    npmLogger.success(`[npm] \`${dep}\` 依赖处理完成!`)
  }

  return {
    isMiniprogramPackage,
    shouldSkipBuild,
    bundleBuild,
    copyBuild,
    buildPackage,
  }
}
