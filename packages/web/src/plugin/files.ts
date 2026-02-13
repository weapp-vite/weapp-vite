import fs from 'fs-extra'
import { extname } from 'pathe'
import { bundleRequire } from 'rolldown-require'

import { SCRIPT_EXTS, STYLE_EXTS, TEMPLATE_EXTS } from './constants'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readJsonFile(pathname: string) {
  const candidates = [pathname]
  if (pathname.endsWith('.json')) {
    candidates.push(`${pathname}.ts`, `${pathname}.js`)
  }

  for (const candidate of candidates) {
    if (!(await fs.pathExists(candidate))) {
      continue
    }
    if (candidate.endsWith('.json')) {
      const json = await fs.readJson(candidate).catch(() => undefined)
      if (!isRecord(json)) {
        return undefined
      }
      return json
    }
    const { mod } = await bundleRequire({
      filepath: candidate,
      preserveTemporaryFile: true,
    })
    const resolved = typeof mod.default === 'function'
      ? await mod.default()
      : mod.default
    if (!isRecord(resolved)) {
      return undefined
    }
    return resolved
  }

  return undefined
}

export async function resolveJsonPath(basePath: string) {
  const candidates = [basePath]
  if (basePath.endsWith('.json')) {
    candidates.push(`${basePath}.ts`, `${basePath}.js`)
  }
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}

export async function resolveScriptFile(basePath: string) {
  const ext = extname(basePath)
  if (ext && (await fs.pathExists(basePath))) {
    return basePath
  }
  for (const candidateExt of SCRIPT_EXTS) {
    const candidate = `${basePath}${candidateExt}`
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}

export async function resolveStyleFile(scriptPath: string) {
  const base = scriptPath.replace(new RegExp(`${extname(scriptPath)}$`), '')
  for (const ext of STYLE_EXTS) {
    const candidate = `${base}${ext}`
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}

export async function resolveTemplateFile(scriptPath: string) {
  const base = scriptPath.replace(new RegExp(`${extname(scriptPath)}$`), '')
  for (const ext of TEMPLATE_EXTS) {
    const candidate = `${base}${ext}`
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}
