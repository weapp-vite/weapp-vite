import type { RuntimePlatform } from '../wevu-runtime.utils'
import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { CLI_PATH } from '../wevu-runtime.utils'

type DependencyMode = 'dependencies' | 'devDependencies'

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-runtime-e2e')
const TEMP_ROOT = path.resolve(import.meta.dirname, '../../.tmp')
const PLATFORM_LIST: RuntimePlatform[] = ['tt', 'alipay']
const tempRoots: string[] = []

async function createFixtureWithWevu(mode: DependencyMode) {
  await fs.ensureDir(TEMP_ROOT)
  const tempRoot = await fs.mkdtemp(path.join(TEMP_ROOT, `wevu-runtime-e2e-${mode}-`))
  tempRoots.push(tempRoot)
  await fs.copy(FIXTURE_ROOT, tempRoot)

  const packageJsonPath = path.join(tempRoot, 'package.json')
  const packageJson = await fs.readJson(packageJsonPath)
  const dependencies = { ...(packageJson.dependencies ?? {}) } as Record<string, string>
  const devDependencies = { ...(packageJson.devDependencies ?? {}) } as Record<string, string>

  delete dependencies.wevu
  delete devDependencies.wevu

  if (mode === 'dependencies') {
    dependencies.wevu = 'workspace:*'
  }
  else {
    devDependencies.wevu = 'workspace:*'
  }

  const nextPackageJson = {
    ...packageJson,
    dependencies: Object.keys(dependencies).length > 0 ? dependencies : undefined,
    devDependencies: Object.keys(devDependencies).length > 0 ? devDependencies : undefined,
  }
  await fs.writeJson(packageJsonPath, nextPackageJson, { spaces: 2 })

  return tempRoot
}

async function runBuild(appRoot: string, platform: RuntimePlatform) {
  const distRoot = path.join(appRoot, 'dist')
  await fs.remove(distRoot)

  const result = await execa('node', [CLI_PATH, 'build', appRoot, '--platform', platform, '--skipNpm'], {
    all: true,
    reject: false,
  })

  expect(result.exitCode).toBe(0)
  const output = result.all ?? `${result.stdout}\n${result.stderr}`
  expect(output).not.toContain('未安装 wevu')

  const commonScriptPath = path.join(distRoot, 'common.js')
  expect(await fs.pathExists(commonScriptPath)).toBe(true)
  return await fs.readFile(commonScriptPath, 'utf8')
}

function assertPlatformTreeShaking(commonScript: string, platform: RuntimePlatform) {
  if (platform === 'tt') {
    expect(commonScript).toMatch(/\?\.tt\b|\.tt\b/)
    expect(commonScript).not.toMatch(/typeof wx/)
    expect(commonScript).not.toMatch(/\?\.my\b|\.my\b/)
    return
  }
  if (platform === 'alipay') {
    expect(commonScript).toMatch(/\?\.my\b|\.my\b/)
    expect(commonScript).not.toMatch(/typeof wx/)
    expect(commonScript).not.toMatch(/\?\.tt\b|\.tt\b/)
  }
}

describe.sequential('wevu runtime dependency modes (platform tree-shaking)', () => {
  afterAll(async () => {
    await Promise.all(tempRoots.map(root => fs.remove(root)))
  })

  it('works when wevu is in devDependencies', async () => {
    const appRoot = await createFixtureWithWevu('devDependencies')
    for (const platform of PLATFORM_LIST) {
      const commonScript = await runBuild(appRoot, platform)
      expect(commonScript).not.toMatch(/require\([`'"]wevu[`'"]\)/)
      assertPlatformTreeShaking(commonScript, platform)
    }
  })

  it('works when wevu is in dependencies', async () => {
    const appRoot = await createFixtureWithWevu('dependencies')
    for (const platform of PLATFORM_LIST) {
      const commonScript = await runBuild(appRoot, platform)
      expect(commonScript).toMatch(/require\([`'"](?:\/node_modules\/)?wevu[`'"]\)/)
      expect(commonScript).not.toContain('未安装 wevu')
    }
  })
})
