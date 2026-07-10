import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import {
  ALIPAY_TEMPLATE_EXTENSION_MAP,
  containsIncompatibleAlipayTemplateSyntax,
  rewriteAlipayReferenceExtensions,
  transformTemplateForAlipay,
} from './alipayTemplate'
import { normalizeMiniprogramPackageJsModules } from './jsModule'
import { collectFiles } from './shared'

const WX_TEMPLATE_REFERENCE_RE = /\.wxml\b|\.wxss\b|\.wxs\b/
const ESM_SYNTAX_RE = /\bimport\s|\bexport\s/
const NULLISH_COALESCING_RE = /\?\?/

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

export async function shouldRebuildCachedAlipayMiniprogramPackage(
  pkgRoot: string,
  outDir: string,
  sourceRoot?: string,
  alipayNpmDistDirName: 'node_modules' | 'miniprogram_npm' = 'miniprogram_npm',
) {
  if (!(await fs.pathExists(pkgRoot))) {
    return true
  }

  if (sourceRoot && alipayNpmDistDirName === 'node_modules') {
    const sourceEsRoot = path.resolve(sourceRoot, 'es')
    const targetEsRoot = path.resolve(pkgRoot, 'es')
    if (await fs.pathExists(sourceEsRoot) && !(await fs.pathExists(targetEsRoot))) {
      return true
    }
  }

  const files = await collectFiles(pkgRoot)
  const textFiles: string[] = []
  for (const filePath of files) {
    const ext = path.extname(filePath)
    if (ext === '.wxml' || ext === '.wxss' || ext === '.wxs') {
      return true
    }

    if (!ALIPAY_TEXT_FILE_EXTENSIONS.has(ext)) {
      continue
    }
    textFiles.push(filePath)
  }

  const staleTextResults = await Promise.all(textFiles.map(async (filePath) => {
    const ext = path.extname(filePath)
    let source = ''
    try {
      source = await fs.readFile(filePath, 'utf8')
    }
    catch {
      return false
    }

    if (WX_TEMPLATE_REFERENCE_RE.test(source)) {
      return true
    }

    if (ext === '.js' && (ESM_SYNTAX_RE.test(source) || NULLISH_COALESCING_RE.test(source))) {
      return true
    }

    if ((ext === '.axml' || ext === '.wxml') && containsIncompatibleAlipayTemplateSyntax(source)) {
      return true
    }
    return false
  }))

  if (staleTextResults.some(Boolean)) {
    return true
  }

  const nestedRoot = path.resolve(pkgRoot, 'miniprogram_npm')
  if (!(await fs.pathExists(nestedRoot))) {
    return false
  }

  const entries = await fs.readdir(nestedRoot)
  const missingNestedTargets = await Promise.all(entries.map(async (name) => {
    const target = path.resolve(outDir, name)
    return !(await fs.pathExists(target))
  }))
  if (missingNestedTargets.some(Boolean)) {
    return true
  }

  return false
}

export async function normalizeMiniprogramPackageForAlipay(pkgRoot: string) {
  if (!(await fs.pathExists(pkgRoot))) {
    return
  }

  const initialFiles = await collectFiles(pkgRoot)
  const renameTasks = initialFiles
    .map((filePath) => {
      const ext = path.extname(filePath)
      const nextExt = ALIPAY_TEMPLATE_EXTENSION_MAP[ext]
      if (!nextExt) {
        return null
      }
      return {
        from: filePath,
        to: `${filePath.slice(0, -ext.length)}${nextExt}`,
      }
    })
    .filter((item): item is { from: string, to: string } => item !== null)

  await Promise.all(renameTasks.map((task) => {
    return fs.move(task.from, task.to, { overwrite: true })
  }))

  await normalizeMiniprogramPackageJsModules(pkgRoot, {
    markEsModule: true,
  })

  const normalizedFiles = await collectFiles(pkgRoot)
  await Promise.all(normalizedFiles.map(async (filePath) => {
    const ext = path.extname(filePath)
    if (!ALIPAY_TEXT_FILE_EXTENSIONS.has(ext)) {
      return
    }

    const source = await fs.readFile(filePath, 'utf8')
    let nextSource = source

    if (ext === '.axml' || ext === '.wxml') {
      nextSource = transformTemplateForAlipay(nextSource)
    }

    nextSource = rewriteAlipayReferenceExtensions(nextSource)

    if (nextSource !== source) {
      await fs.writeFile(filePath, nextSource)
    }
  }))
}

export async function hoistNestedMiniprogramDependenciesForAlipay(pkgRoot: string, outDir: string) {
  const nestedRoot = path.resolve(pkgRoot, 'miniprogram_npm')
  if (!(await fs.pathExists(nestedRoot))) {
    return
  }

  const entries = await fs.readdir(nestedRoot)
  await Promise.all(entries.map(async (name) => {
    const source = path.resolve(nestedRoot, name)
    const target = path.resolve(outDir, name)

    if (await fs.pathExists(target)) {
      return
    }

    await fs.copy(source, target, {
      overwrite: false,
      errorOnExist: false,
    })

    await normalizeMiniprogramPackageForAlipay(target)
  }))
}

export async function copyEsModuleDirectoryForAlipay(sourceRoot: string, targetRoot: string) {
  const sourceDir = path.resolve(sourceRoot, 'es')
  if (!(await fs.pathExists(sourceDir))) {
    return false
  }

  await fs.copy(sourceDir, path.resolve(targetRoot, 'es'), {
    overwrite: true,
  })
  return true
}
