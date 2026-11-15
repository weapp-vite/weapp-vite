import { fdir } from 'fdir'
import MagicString from 'magic-string'
import path from 'pathe'
import { expect } from 'vitest'
import { outputTemplateParser } from '../../../../packages/weapp-vite/src/wxml/template/parser'
import { DIST_ROOT } from './constants'

const SCOPE_CLASS_RE = /(?:^|\s)data-v-[\w-]+$/
const SCOPE_ATTRIBUTE_RE = /^data-v-[\w-]+$/

export async function scanFiles(root: string) {
  // eslint-disable-next-line new-cap
  const fd = new fdir({
    relativePaths: true,
    pathSeparator: '/',
  })
  return (await fd.crawl(root).withPromise()).sort()
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripGeneratedScopeAttrs(code: string) {
  if (!code.includes('data-v-')) {
    return code
  }

  let scanned = outputTemplateParser('weapp', 'legacy').scan(code)
  if (scanned.diagnostics.some(item => item.severity === 'error')) {
    scanned = outputTemplateParser('weapp', 'xml').scan(code)
  }
  const diagnostic = scanned.diagnostics.find(item => item.severity === 'error')
  if (diagnostic) {
    throw new Error(`[weapp.wxml] ${diagnostic.start}: ${diagnostic.message}`)
  }

  const result = new MagicString(code)
  for (const token of scanned.tokens) {
    if (token.kind !== 'tag' || token.closing) {
      continue
    }
    const classAttribute = [...token.attributes].reverse().find(attribute => attribute.name === 'class')
    if (classAttribute?.valueStart !== undefined && classAttribute.valueEnd !== undefined) {
      let value = code.slice(classAttribute.valueStart, classAttribute.valueEnd)
      while (true) {
        const match = SCOPE_CLASS_RE.exec(value)
        if (!match) {
          break
        }
        value = value.slice(0, match.index).trimEnd()
      }
      if (value) {
        result.overwrite(classAttribute.valueStart, classAttribute.valueEnd, value)
      }
      else {
        const start = classAttribute.start > 0 && /\s/.test(code[classAttribute.start - 1]!)
          ? classAttribute.start - 1
          : classAttribute.start
        result.remove(start, classAttribute.end)
      }
    }

    for (const attribute of token.attributes) {
      if (!SCOPE_ATTRIBUTE_RE.test(attribute.name) || attribute.value !== '') {
        continue
      }
      const start = attribute.start > 0 && /\s/.test(code[attribute.start - 1]!)
        ? attribute.start - 1
        : attribute.start
      result.remove(start, attribute.end)
    }
  }
  return result.toString()
}

export function expectModuleReference(code: string, specifier: string) {
  const escapedSpecifier = escapeRegex(specifier)
  const escapedBuiltSpecifier = `(?:\\.\\.\\/)+miniprogram_npm\\/${escapedSpecifier}(?:\\/index)?`
  expect(code).toMatch(new RegExp(`(?:require\\((['"\`])(?:${escapedSpecifier}|${escapedBuiltSpecifier})\\1\\)|from\\s+(['"\`])(?:${escapedSpecifier}|${escapedBuiltSpecifier})\\2)`))
}

export function createCachedEnvLinePattern(variableName: string) {
  return new RegExp(
    `const ${variableName} = .*globalThis\\["__weappViteImportMetaEnv"\\].*JSON\\.parse\\(`,
  )
}

export function findGeneratedPosition(code: string, needle: string) {
  const lines = code.split('\n')
  const lineIndex = lines.findIndex(line => line.includes(needle))
  expect(lineIndex).toBeGreaterThanOrEqual(0)
  return {
    column: lines[lineIndex].indexOf(needle),
    line: lineIndex + 1,
  }
}

export function createObjectPropertyPattern(property: string, value: string) {
  return new RegExp(`${escapeRegex(JSON.stringify(property))}\\s*:\\s*${escapeRegex(JSON.stringify(value))}`)
}

export function expectProductionEnvironment(pageJs: string) {
  expect(pageJs).toMatch(/issue792\s*:\s*\{\s*dev\s*:\s*false\s*,\s*mode\s*:\s*["']production["']\s*,\s*nodeEnv\s*:\s*["']production["']\s*,\s*prod\s*:\s*true\s*\}/)
}

export function expectSetDataPickKeys(code: string, keys: string[]) {
  const match = code.match(/setData\s*:\s*\{\s*pick\s*:\s*\[([\s\S]*?)\]/)
  expect(match?.[1]).toBeTruthy()
  for (const key of keys) {
    expect(match![1]).toContain(JSON.stringify(key))
  }
}

export function createSerializedJsonEntryPattern(key: string, value: string) {
  return new RegExp(escapeRegex(`\\"${key}\\":\\"${value}\\"`))
}

export function resolveSharedRuntimeImport(sourceFilePath: string, sourceCode: string) {
  const relativeImports = [
    ...[...sourceCode.matchAll(/require\((['"`])([^"'`]+)\1\)/g)].map(match => match[2]!),
    ...[...sourceCode.matchAll(/from\s+(['"`])([^"'`]+)\1/g)].map(match => match[2]!),
  ]
  const candidates = relativeImports
    .map(importee => path.resolve(path.dirname(sourceFilePath), importee))
    .filter(candidate => candidate.startsWith(DIST_ROOT) && path.extname(candidate) === '.js')

  return candidates.find(candidate => candidate.includes(`${path.sep}weapp-vendors${path.sep}`))
    ?? candidates[0]
}
