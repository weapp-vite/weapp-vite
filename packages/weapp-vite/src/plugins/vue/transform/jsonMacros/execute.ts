import * as t from '@babel/types'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { withTempDirLock } from '../tempDirLock'
import { rewriteRelativeImportSource } from '../tempImportRewrite'
import { resolveWevuConfigTempDir } from '../wevuTempDir'

function normalizeScriptSetupLang(lang?: string) {
  if (!lang) {
    return 'ts'
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return 'ts'
  }
  return lower
}

function resolveScriptSetupExtension(lang?: string) {
  const normalized = normalizeScriptSetupLang(lang)
  if (normalized === 'ts' || normalized === 'tsx' || normalized === 'cts' || normalized === 'mts') {
    return 'ts'
  }
  return 'js'
}

function resolveMacroAlias(macroName: string) {
  return macroName === 'defineAppJson'
    ? '__weapp_defineAppJson'
    : macroName === 'definePageJson'
      ? '__weapp_definePageJson'
      : '__weapp_defineComponentJson'
}

export async function evaluateScriptSetupJsonMacro(params: {
  originalContent: string
  filename: string
  lang?: string
  macroName: string
  macroStatements: any[]
  bodyPaths: any[]
  keptStatementPaths: Set<any>
  options?: {
    merge?: (target: Record<string, any>, source: Record<string, any>) => Record<string, any> | void
  }
}) {
  const {
    originalContent,
    filename,
    lang,
    macroName,
    macroStatements,
    bodyPaths,
    keptStatementPaths,
    options,
  } = params

  const ms = new MagicString(originalContent)

  const dir = path.dirname(filename)
  const tempDir = resolveWevuConfigTempDir(dir)

  for (const statementPath of keptStatementPaths) {
    if (!statementPath.isImportDeclaration()) {
      continue
    }
    const sourceNode = statementPath.node.source
    if (!sourceNode || !t.isStringLiteral(sourceNode)) {
      continue
    }
    const originalSource = sourceNode.value
    if (!originalSource.startsWith('.')) {
      continue
    }
    const next = rewriteRelativeImportSource(originalSource, dir, tempDir)
    if (typeof sourceNode.start === 'number' && typeof sourceNode.end === 'number') {
      ms.overwrite(sourceNode.start, sourceNode.end, JSON.stringify(next))
    }
  }

  const alias = resolveMacroAlias(macroName)

  for (const statementPath of macroStatements) {
    const callPath = statementPath.get('expression')
    const calleePath = callPath.get('callee')
    if (calleePath?.isIdentifier() && typeof calleePath.node.start === 'number' && typeof calleePath.node.end === 'number') {
      ms.overwrite(calleePath.node.start, calleePath.node.end, alias)
    }
  }

  for (const statementPath of bodyPaths) {
    if (keptStatementPaths.has(statementPath)) {
      continue
    }
    const start = statementPath.node.start
    const end = statementPath.node.end
    if (typeof start === 'number' && typeof end === 'number') {
      ms.remove(start, end)
    }
  }

  const header = `
const __weapp_json_macro_values = []
const __weapp_defineAppJson = (config) => (__weapp_json_macro_values.push(config), config)
const __weapp_definePageJson = (config) => (__weapp_json_macro_values.push(config), config)
const __weapp_defineComponentJson = (config) => (__weapp_json_macro_values.push(config), config)
`.trimStart()
  const footer = `\nexport default __weapp_json_macro_values\n`
  const evalSource = header + ms.toString() + footer

  const extension = resolveScriptSetupExtension(lang)
  return await withTempDirLock(tempDir, async () => {
    await fs.ensureDir(tempDir)
    const basename = path.basename(filename, path.extname(filename))
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const tempFile = path.join(tempDir, `${basename}.json-macro.${unique}.${extension}`)
    await fs.writeFile(tempFile, evalSource, 'utf8')

    try {
      const { mod } = await bundleRequire<{ default?: any }>({
        filepath: tempFile,
        cwd: dir,
      })

      const resolved: any = mod?.default ?? mod
      const values: any[] = Array.isArray(resolved) ? resolved : [resolved]

      let accumulator: Record<string, any> = {}
      for (const raw of values) {
        if (raw === undefined) {
          continue
        }
        let next: any = raw
        if (typeof next === 'function') {
          next = next()
        }
        if (next && typeof next.then === 'function') {
          next = await next
        }
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
          throw new Error('宏的返回值必须解析为对象。')
        }
        if (Object.prototype.hasOwnProperty.call(next, '$schema')) {
          delete next.$schema
        }
        if (options?.merge) {
          const merged = options.merge(accumulator, next)
          if (merged && typeof merged === 'object' && !Array.isArray(merged)) {
            accumulator = merged as Record<string, any>
          }
        }
        else {
          mergeRecursive(accumulator, next)
        }
      }

      if (!Object.keys(accumulator).length) {
        return undefined
      }
      return accumulator
    }
    finally {
      try {
        await fs.remove(tempFile)
      }
      catch {
        // 忽略
      }
      try {
        const remains = await fs.readdir(tempDir)
        if (remains.length === 0) {
          await fs.remove(tempDir)
        }
      }
      catch {
        // 忽略
      }
    }
  })
}
