import { fdir } from 'fdir'
import path from 'pathe'
import { expect } from 'vitest'
import { DIST_ROOT } from './constants'

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
  return code.replace(/\sdata-v-[\w-]+=""/g, '')
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
