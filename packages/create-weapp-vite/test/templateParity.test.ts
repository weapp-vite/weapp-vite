import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, vi } from 'vitest'
import { __internal as createProjectInternal } from '@/createProject'
import { TemplateName } from '@/enums'
import { TEMPLATE_CATALOG, TEMPLATE_NAMED_CATALOG } from '@/generated/catalog'
import { createProject } from '@/index'
import * as npm from '@/npm'

const DIGIT_RE = /\d/
const FIXED_OUTPUT_ENV_NAME = 'CREATE_WEAPP_VITE_TEST_OUTPUT_DIR'

interface PackageJsonLike {
  name?: string
  version?: string
  private?: boolean
  type?: string
  homepage?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

function normalizeRelativePath(value: string) {
  return value.split(path.sep).join('/')
}

function shouldSkipTemplateFile(filePath: string) {
  return (
    filePath.includes('node_modules')
    || filePath.includes(`${path.sep}.weapp-vite${path.sep}`)
    || filePath.includes('vite.config.ts.timestamp')
    || /vite\.config\.ts\.timestamp-[^/\\]+\.mjs$/.test(filePath)
    || filePath.includes(`${path.sep}dist${path.sep}`)
    || filePath.endsWith(`${path.sep}CHANGELOG.md`)
    || filePath.includes(`${path.sep}.turbo${path.sep}`)
    || filePath.endsWith(`${path.sep}.DS_Store`)
  )
}

function normalizeExpectedProjectPath(relativePath: string) {
  if (relativePath === 'gitignore') {
    return '.gitignore'
  }
  return relativePath
}

function shouldSkipCreatedProjectFile(relativePath: string) {
  return (
    relativePath === 'CHANGELOG.md'
    || relativePath.startsWith('node_modules/')
    || relativePath.startsWith('.weapp-vite/')
    || relativePath.startsWith('dist/')
    || relativePath.startsWith('.turbo/')
    || relativePath === '.DS_Store'
    || relativePath === 'vite.config.ts.timestamp'
    || /^vite\.config\.ts\.timestamp-[^/]+\.mjs$/.test(relativePath)
  )
}

async function scanFiles(root: string) {
  const out: string[] = []

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      const relativePath = normalizeRelativePath(path.relative(root, full))
      if (shouldSkipCreatedProjectFile(relativePath)) {
        continue
      }
      out.push(relativePath)
    }
  }

  if (await fs.pathExists(root)) {
    await walk(root)
  }

  return out.sort((a, b) => a.localeCompare(b))
}

async function collectExpectedTemplateFiles(templateName: TemplateName) {
  const { preferredTemplateDir } = await createProjectInternal.resolveTemplateDirs(templateName)
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name)
      if (shouldSkipTemplateFile(full)) {
        continue
      }
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      files.push(
        normalizeExpectedProjectPath(normalizeRelativePath(path.relative(preferredTemplateDir, full))),
      )
    }
  }

  await walk(preferredTemplateDir)
  files.push('AGENTS.md')

  return files.sort((a, b) => a.localeCompare(b))
}

async function collectTemplateFilesBySuffix(root: string, suffixes: string[]) {
  const out: string[] = []

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (shouldSkipTemplateFile(full)) {
        continue
      }
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (suffixes.some(suffix => entry.name.endsWith(suffix))) {
        out.push(full)
      }
    }
  }

  await walk(root)

  return out.sort((a, b) => a.localeCompare(b))
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

async function readJsonAs<T>(filePath: string) {
  return await fs.readJSON(filePath) as T
}

async function readPackageJson(filePath: string) {
  const pkgJson = await readJsonAs<PackageJsonLike>(filePath)
  return {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {},
    scripts: {},
    ...pkgJson,
  } satisfies PackageJsonLike
}

function resolveCatalogSpec(packageName: string, spec: string) {
  if (!spec.startsWith('catalog:')) {
    return spec
  }

  const catalogName = spec.slice('catalog:'.length)
  if (!catalogName) {
    return TEMPLATE_CATALOG[packageName as keyof typeof TEMPLATE_CATALOG] ?? spec
  }

  const namedCatalog = TEMPLATE_NAMED_CATALOG[catalogName as keyof typeof TEMPLATE_NAMED_CATALOG]
  const fromNamedCatalog = namedCatalog?.[packageName as keyof typeof namedCatalog]
  if (!fromNamedCatalog) {
    return TEMPLATE_CATALOG[packageName as keyof typeof TEMPLATE_CATALOG] ?? spec
  }

  if (fromNamedCatalog === 'latest') {
    return TEMPLATE_CATALOG[packageName as keyof typeof TEMPLATE_CATALOG] ?? fromNamedCatalog
  }

  return fromNamedCatalog
}

function normalizeDependencySpecs(pkgJson: Record<string, any>) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkgJson[field]
    if (!deps) {
      continue
    }

    for (const [name, rawSpec] of Object.entries(deps)) {
      if (typeof rawSpec !== 'string') {
        continue
      }

      if (rawSpec.startsWith('catalog:')) {
        deps[name] = resolveCatalogSpec(name, rawSpec)
        continue
      }

      if (!rawSpec.startsWith('workspace:')) {
        continue
      }

      const workspaceSpec = rawSpec.slice('workspace:'.length)
      if (workspaceSpec && DIGIT_RE.test(workspaceSpec)) {
        deps[name] = workspaceSpec
        continue
      }

      const fromCatalog = TEMPLATE_CATALOG[name as keyof typeof TEMPLATE_CATALOG]
      if (fromCatalog) {
        deps[name] = fromCatalog
      }
    }
  }
}

function upsertDependencyVersion(pkgJson: Record<string, any>, packageName: string, resolvedVersion: string) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (pkgJson[field]?.[packageName]) {
      pkgJson[field][packageName] = resolvedVersion
    }
  }
}

async function buildExpectedPackageJson(templateName: TemplateName): Promise<PackageJsonLike> {
  const { preferredTemplateDir } = await createProjectInternal.resolveTemplateDirs(templateName)
  const templatePackageJsonPath = path.join(preferredTemplateDir, 'package.json')
  const templatePackageJson: PackageJsonLike = await fs.pathExists(templatePackageJsonPath)
    ? await readPackageJson(templatePackageJsonPath)
    : {
        dependencies: {},
        devDependencies: {},
        name: 'weapp-vite-app',
        homepage: 'https://vite.icebreaker.top/',
        optionalDependencies: {},
        peerDependencies: {},
        type: 'module',
        scripts: {},
      }
  const expectedPackageJson: PackageJsonLike = cloneJson(templatePackageJson)
  const { version: weappViteVersion } = await readPackageJson(
    path.resolve(import.meta.dirname, '../../..', 'packages/weapp-vite/package.json'),
  )
  const { version: wevuVersion } = await readPackageJson(
    path.resolve(import.meta.dirname, '../../..', 'packages-runtime/wevu/package.json'),
  )
  const { version: dashboardVersion } = await readPackageJson(
    path.resolve(import.meta.dirname, '../../..', 'packages/dashboard/package.json'),
  )
  normalizeDependencySpecs(expectedPackageJson)
  expectedPackageJson.devDependencies ??= {}
  upsertDependencyVersion(expectedPackageJson, 'weapp-vite', `^${weappViteVersion}`)
  upsertDependencyVersion(expectedPackageJson, 'wevu', `^${wevuVersion}`)
  upsertDependencyVersion(expectedPackageJson, '@weapp-vite/dashboard', `^${dashboardVersion}`)

  if (
    !expectedPackageJson.dependencies?.['@types/node']
    && !expectedPackageJson.devDependencies['@types/node']
    && !expectedPackageJson.peerDependencies?.['@types/node']
    && !expectedPackageJson.optionalDependencies?.['@types/node']
  ) {
    expectedPackageJson.devDependencies['@types/node'] = TEMPLATE_CATALOG['@types/node']
  }

  if (!expectedPackageJson.devDependencies['weapp-tailwindcss']) {
    expectedPackageJson.devDependencies['weapp-tailwindcss'] = '^4.3.3'
  }

  return expectedPackageJson
}

describe('template catalog', () => {
  it('includes typing and lint packages used by templates and generated configs', () => {
    expect(TEMPLATE_CATALOG['miniprogram-api-typings']).toBeTruthy()
    expect(TEMPLATE_CATALOG['@types/node']).toBeTruthy()
    expect(TEMPLATE_CATALOG['@mini-types/alipay']).toBeTruthy()
    expect(TEMPLATE_CATALOG['@douyin-microapp/typings']).toBeTruthy()
    expect(TEMPLATE_CATALOG['@icebreakers/eslint-config']).toBeTruthy()
    expect(TEMPLATE_CATALOG['@icebreakers/stylelint-config']).toBeTruthy()
    expect(TEMPLATE_CATALOG.eslint).toBeTruthy()
    expect(TEMPLATE_CATALOG.stylelint).toBeTruthy()
  })
})

describe('template package sources', () => {
  it.each(Object.values(TemplateName))('uses catalog specs for shared lint deps in template %s', async (templateName) => {
    const { preferredTemplateDir } = await createProjectInternal.resolveTemplateDirs(templateName)
    const pkgJson = await readPackageJson(path.join(preferredTemplateDir, 'package.json'))

    expect(pkgJson.devDependencies?.['@icebreakers/eslint-config']).toBe('catalog:')
    expect(pkgJson.devDependencies?.['@icebreakers/stylelint-config']).toBe('catalog:')
    expect(pkgJson.devDependencies?.['@types/node']).toBe('catalog:')
    expect(pkgJson.devDependencies?.eslint).toBe('catalog:')
    expect(pkgJson.devDependencies?.stylelint).toBe('catalog:')
  })
})

function expectNoUnresolvedDependencySpec(pkgJson: Record<string, any>) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkgJson[field]
    if (!deps) {
      continue
    }

    for (const spec of Object.values(deps)) {
      expect(typeof spec).toBe('string')
      expect(spec).not.toMatch(/^catalog:/)
      expect(spec).not.toMatch(/^workspace:/)
    }
  }
}

describe('template parity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function createTmpRoot(suffix: string) {
    const fixedOutputRoot = process.env[FIXED_OUTPUT_ENV_NAME]
    if (fixedOutputRoot) {
      const root = path.resolve(fixedOutputRoot, suffix)
      await fs.remove(root)
      await fs.ensureDir(root)
      return root
    }

    return await fs.mkdtemp(path.join(os.tmpdir(), `weapp-template-parity-${suffix}-`))
  }

  it.each(Object.values(TemplateName))('creates complete offline output for template %s', async (templateName) => {
    const root = await createTmpRoot(templateName)
    vi.spyOn(npm, 'latestVersion').mockResolvedValue(null)

    await createProject(root, templateName)

    const [expectedFiles, actualFiles, expectedPackageJson, actualPackageJson] = await Promise.all([
      collectExpectedTemplateFiles(templateName),
      scanFiles(root),
      buildExpectedPackageJson(templateName),
      readPackageJson(path.join(root, 'package.json')),
    ])
    const actualFileSet = new Set(actualFiles)
    const expectedFileSet = new Set(expectedFiles)
    const missingFiles = expectedFiles.filter(file => !actualFileSet.has(file))
    const unexpectedFiles = actualFiles.filter(file => !expectedFileSet.has(file))

    expect(missingFiles).toEqual([])
    expect(unexpectedFiles).toEqual([])
    expect(await fs.pathExists(path.join(root, '.gitignore'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'gitignore'))).toBe(false)
    expect(await fs.pathExists(path.join(root, 'package.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'project.config.json'))).toBe(true)
    expect(actualPackageJson.scripts).toEqual(expectedPackageJson.scripts)
    expect(actualPackageJson.type).toBe(expectedPackageJson.type)
    expect(actualPackageJson.private).toBe(expectedPackageJson.private)
    expect(actualPackageJson.homepage).toBe(expectedPackageJson.homepage)
    expect(actualPackageJson.dependencies).toEqual(expectedPackageJson.dependencies)
    expect(actualPackageJson.devDependencies).toEqual(expectedPackageJson.devDependencies)
    expect(actualPackageJson.peerDependencies).toEqual(expectedPackageJson.peerDependencies)
    expect(actualPackageJson.optionalDependencies).toEqual(expectedPackageJson.optionalDependencies)
    expectNoUnresolvedDependencySpec(actualPackageJson)
  })

  it.each(Object.values(TemplateName))('does not keep legacy @wevu/api imports in template sources %s', async (templateName) => {
    const { preferredTemplateDir } = await createProjectInternal.resolveTemplateDirs(templateName)
    const sourceFiles = await collectTemplateFilesBySuffix(preferredTemplateDir, ['.ts', '.vue'])

    for (const sourceFile of sourceFiles) {
      const content = await fs.readFile(sourceFile, 'utf8')
      expect(content).not.toContain(`from '@wevu/api'`)
    }
  })
})
