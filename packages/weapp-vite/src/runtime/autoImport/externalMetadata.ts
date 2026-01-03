import type { ComponentPropMap } from '../componentProps'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import path from 'pathe'
import { resolveExternalMetadataCandidates } from '../../auto-import-components/resolvers/externalMetadata'
import { extractComponentProps } from '../componentProps'
import { extractComponentPropsFromDts } from './dtsProps'

export interface ExternalComponentMetadata {
  types: ComponentPropMap
}

function safeCreateRequire(cwd: string) {
  try {
    return createRequire(path.join(cwd, 'package.json'))
  }
  catch {
    return createRequire(import.meta.url)
  }
}

function tryResolvePackageRoot(packageName: string, cwd: string) {
  const require = safeCreateRequire(cwd)
  try {
    const pkgJson = require.resolve(`${packageName}/package.json`)
    return path.dirname(pkgJson)
  }
  catch {
    return undefined
  }
}

function readTextIfExists(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined
    }
    return fs.readFileSync(filePath, 'utf8')
  }
  catch {
    return undefined
  }
}

function resolveResolverMetadataFiles(from: string, cwd: string) {
  const candidates = resolveExternalMetadataCandidates(from)
  if (!candidates) {
    return undefined
  }

  const pkgRoot = tryResolvePackageRoot(candidates.packageName, cwd)
  if (!pkgRoot) {
    return undefined
  }

  return {
    dts: candidates.dts.map(file => path.join(pkgRoot, file)),
    js: candidates.js.map(file => path.join(pkgRoot, file)),
  }
}

function resolveGenericMetadataFiles(from: string, cwd: string) {
  if (!from || from.startsWith('/')) {
    return undefined
  }

  const require = safeCreateRequire(cwd)
  try {
    const resolved = require.resolve(from)
    const ext = path.extname(resolved)
    const base = ext ? resolved.slice(0, -ext.length) : resolved
    return {
      dts: [`${base}.d.ts`],
      js: [`${base}.js`, `${base}.cjs`, `${base}.mjs`],
    }
  }
  catch {
    return undefined
  }
}

function resolveExternalMetadataFiles(from: string, cwd: string) {
  return resolveResolverMetadataFiles(from, cwd)
    ?? resolveGenericMetadataFiles(from, cwd)
}

export function loadExternalComponentMetadata(from: string, cwd: string): ExternalComponentMetadata | undefined {
  const files = resolveExternalMetadataFiles(from, cwd)
  if (!files) {
    return undefined
  }

  for (const candidate of files.dts) {
    const code = readTextIfExists(candidate)
    if (!code) {
      continue
    }
    try {
      const types = extractComponentPropsFromDts(code)
      if (types.size > 0) {
        return { types }
      }
    }
    catch {
      // ignore
    }
  }

  for (const candidate of files.js) {
    const code = readTextIfExists(candidate)
    if (!code) {
      continue
    }
    try {
      const types = extractComponentProps(code)
      if (types.size > 0) {
        return { types }
      }
    }
    catch {
      // ignore
    }
  }

  return undefined
}
