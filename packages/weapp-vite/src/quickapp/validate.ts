import type { ParserPlugin } from '@babel/parser'
import { readFile } from 'node:fs/promises'
import { parse as parseBabel } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'

const MINI_PROGRAM_GLOBAL_CALLS = new Set(['App', 'Page', 'Component', 'setData'])
const SCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])

function getMemberPropertyName(member: t.MemberExpression) {
  if (!member.computed && t.isIdentifier(member.property)) {
    return member.property.name
  }
  if (member.computed && t.isStringLiteral(member.property)) {
    return member.property.value
  }
}

function findMiniProgramScriptMarker(source: string, filename: string, plugins: ParserPlugin[]) {
  const ast = parseBabel(source, {
    sourceFilename: filename,
    sourceType: 'unambiguous',
    plugins,
  })
  let marker: string | undefined
  traverse(ast, {
    CallExpression(scriptPath) {
      const callee = scriptPath.node.callee
      if (t.isIdentifier(callee) && MINI_PROGRAM_GLOBAL_CALLS.has(callee.name)) {
        marker = `${callee.name}()`
        scriptPath.stop()
        return
      }
      if (!t.isMemberExpression(callee)) {
        return
      }
      if (t.isIdentifier(callee.object, { name: 'wx' })) {
        marker = 'wx.*'
        scriptPath.stop()
        return
      }
      if (getMemberPropertyName(callee) === 'setData') {
        marker = 'setData()'
        scriptPath.stop()
      }
    },
    MemberExpression(scriptPath) {
      if (t.isIdentifier(scriptPath.node.object, { name: 'wx' })) {
        marker = 'wx.*'
        scriptPath.stop()
      }
    },
  })
  return marker
}

function getSfcScriptBlocks(source: string, filename: string) {
  const parsed = parseSfc(source, { filename })
  if (parsed.errors.length > 0) {
    throw parsed.errors[0]
  }
  return [parsed.descriptor.script, parsed.descriptor.scriptSetup]
    .filter((block): block is NonNullable<typeof block> => Boolean(block))
    .map(block => ({
      content: block.content,
      plugins: block.lang === 'ts' || block.lang === 'tsx'
        ? ['typescript', ...(block.lang === 'tsx' ? ['jsx'] : [])] as ParserPlugin[]
        : block.lang === 'jsx' ? ['jsx'] as ParserPlugin[] : [],
    }))
}

function hasUsingComponents(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'usingComponents' in value)
}

export async function validateQuickAppSourceSemantics(srcDir: string, sourceFiles: string[]) {
  for (const filePath of sourceFiles) {
    const extension = path.extname(filePath).toLowerCase()
    const relativePath = path.relative(srcDir, filePath).replaceAll('\\', '/')
    if (extension === '.json' && relativePath !== 'manifest.json') {
      const json = JSON.parse(await readFile(filePath, 'utf8')) as unknown
      if (hasUsingComponents(json)) {
        throw new Error(`QuickApp 目标不支持转换小程序 usingComponents：${relativePath}`)
      }
      continue
    }

    const source = await readFile(filePath, 'utf8')
    const scripts = SCRIPT_EXTENSIONS.has(extension)
      ? [{
          content: source,
          plugins: extension === '.ts' || extension === '.tsx'
            ? ['typescript', ...(extension === '.tsx' ? ['jsx'] : [])] as ParserPlugin[]
            : extension === '.jsx' ? ['jsx'] as ParserPlugin[] : [],
        }]
      : extension === '.vue' || extension === '.ux'
        ? getSfcScriptBlocks(source, filePath)
        : []

    for (const script of scripts) {
      const marker = findMiniProgramScriptMarker(script.content, filePath, script.plugins)
      if (marker) {
        throw new Error(`QuickApp 目标不支持转换小程序运行时 API ${marker}：${relativePath}`)
      }
    }
  }
}
