import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import YAML from 'yaml'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))
const WORKSPACE_FILE = path.resolve(ROOT_DIR, 'pnpm-workspace.yaml')
const CONFIG_FILENAMES = [
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.cjs',
  'vitest.config.mjs',
] as const
const WINDOWS_PATH_SEPARATOR_RE = /\\/g
const LEADING_DOT_SLASH_RE = /^\.\//
const GLOB_META_RE = /[*?[{]/
const TRAILING_SLASH_RE = /\/+$/

function extractBaseDirFromGlob(pattern: string): string | null {
  if (!pattern) {
    return null
  }

  const normalized = pattern
    .replace(WINDOWS_PATH_SEPARATOR_RE, '/')
    .replace(LEADING_DOT_SLASH_RE, '')
  const globIndex = normalized.search(GLOB_META_RE)
  const base = globIndex === -1
    ? normalized
    : normalized.slice(0, globIndex)

  const cleaned = base.replace(TRAILING_SLASH_RE, '')
  return cleaned || null
}

function loadProjectRootsFromWorkspace(): string[] {
  if (!fs.existsSync(WORKSPACE_FILE)) {
    return []
  }

  try {
    const workspaceContent = fs.readFileSync(WORKSPACE_FILE, 'utf8')
    const workspace = YAML.parse(workspaceContent) ?? {}
    const packages: unknown[] = Array.isArray(workspace.packages) ? workspace.packages : []
    const roots = packages
      .map(entry => typeof entry === 'string' ? entry.trim() : '')
      .filter(entry => entry && !entry.startsWith('!'))
      .map(extractBaseDirFromGlob)
      .filter((entry): entry is string => Boolean(entry))

    return roots.length ? Array.from(new Set(roots)) : []
  }
  catch (error) {
    console.warn('[vitest] Failed to parse pnpm-workspace.yaml, no project roots will be used.', error)
    return []
  }
}

const PROJECT_ROOTS = loadProjectRootsFromWorkspace()
const COVERAGE_TEMP_DIR = path.resolve(ROOT_DIR, 'coverage/.tmp')
const DEFAULT_WORKSPACE_MAX_WORKERS = '50%'
const workspaceMaxWorkers = process.env.WEAPP_VITE_TEST_MAX_WORKERS?.trim() || DEFAULT_WORKSPACE_MAX_WORKERS

if (!PROJECT_ROOTS.length) {
  console.warn('[vitest] No project roots detected. Check pnpm-workspace.yaml to define workspace packages.')
}

fs.mkdirSync(COVERAGE_TEMP_DIR, { recursive: true })

function findConfig(basePath: string): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(basePath, filename)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function resolveProjects(): string[] {
  const projects: string[] = []

  for (const folder of PROJECT_ROOTS) {
    const rootPath = path.resolve(ROOT_DIR, folder)
    if (!fs.existsSync(rootPath)) {
      continue
    }

    const rootConfig = findConfig(rootPath)
    if (rootConfig) {
      projects.push(rootConfig)
    }

    const entries = fs.readdirSync(rootPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const projectDir = path.join(rootPath, entry.name)
      const configPath = findConfig(projectDir)
      if (configPath) {
        projects.push(configPath)
      }
    }
  }

  return projects
}

const projects = resolveProjects()

export default defineConfig(() => {
  return {
    test: {
      globalSetup: ['./vitest.globalSetup.ts'],
      maxWorkers: workspaceMaxWorkers,
      projects,
      coverage: {
        enabled: false,
      },
      forceRerunTriggers: [
        '**/{vitest,vite}.config.*/**',
      ],
    },
  }
})
