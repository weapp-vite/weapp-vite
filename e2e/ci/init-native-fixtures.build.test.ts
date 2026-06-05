/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI init。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const ROOT = path.resolve(import.meta.dirname, '../..')
const WEAPP_VITE_CLI_PATH = path.resolve(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const CREATE_WEAPP_VITE_CLI_PATH = path.resolve(ROOT, 'packages/create-weapp-vite/bin/create-weapp-vite.js')
const TEMP_ROOT = path.resolve(ROOT, '.tmp')
const FIXTURES = [
  {
    label: 'js-base',
    sourceRoot: path.resolve(ROOT, 'fixtures/js-base'),
    expectedSrcRoot: '.',
  },
  {
    label: 'ts-base',
    sourceRoot: path.resolve(ROOT, 'fixtures/ts-base'),
    expectedSrcRoot: 'miniprogram',
  },
] as const
const INIT_COMMANDS = [
  {
    commandLabel: 'weapp-vite',
    cliPath: WEAPP_VITE_CLI_PATH,
  },
  {
    commandLabel: 'create-weapp-vite',
    cliPath: CREATE_WEAPP_VITE_CLI_PATH,
  },
] as const

const tempRoots: string[] = []

async function collectFileSnapshot(root: string) {
  const snapshot: Record<string, string> = {}

  async function visit(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(entryPath)
        continue
      }
      if (!entry.isFile()) {
        continue
      }
      const relativePath = path.relative(root, entryPath).replaceAll('\\', '/')
      snapshot[relativePath] = await fs.readFile(entryPath, 'utf8')
    }
  }

  await visit(root)
  return snapshot
}

async function createFixtureCopy(label: string, sourceRoot: string, commandLabel: string) {
  await fs.ensureDir(TEMP_ROOT)
  const tempRoot = await fs.mkdtemp(path.join(TEMP_ROOT, `init-${commandLabel}-${label}-`))
  tempRoots.push(tempRoot)
  const projectRoot = path.join(tempRoot, label)
  await fs.copy(sourceRoot, projectRoot)
  return projectRoot
}

async function runInit(projectRoot: string, cliPath: string) {
  await execa('node', [cliPath, 'init'], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
}

async function expectInitializedProject(projectRoot: string, expectedSrcRoot: string) {
  const packageJson = await fs.readJson(path.join(projectRoot, 'package.json')) as Record<string, any>
  const projectConfig = await fs.readJson(path.join(projectRoot, 'project.config.json')) as Record<string, any>
  const viteConfig = await fs.readFile(path.join(projectRoot, 'vite.config.ts'), 'utf8')

  expect(packageJson.scripts).toMatchObject({
    'dev': 'weapp-vite dev',
    'dev:open': 'weapp-vite dev -o',
    'build': 'weapp-vite build',
    'open': 'weapp-vite open',
  })
  expect(projectConfig.miniprogramRoot).toBe('dist/')
  expect(projectConfig.srcMiniprogramRoot).toBe('dist/')
  expect(viteConfig).toContain(`srcRoot: '${expectedSrcRoot}'`)
}

async function expectBuildOutput(projectRoot: string) {
  expect(await fs.pathExists(path.join(projectRoot, 'dist/app.json'))).toBe(true)
  expect(await fs.pathExists(path.join(projectRoot, 'dist/pages/index/index.js'))).toBe(true)
  expect(await fs.pathExists(path.join(projectRoot, 'dist/pages/index/index.wxml'))).toBe(true)
}

afterAll(async () => {
  await Promise.all(tempRoots.splice(0).map(root => fs.remove(root)))
})

describe.sequential('weapp-vite init native fixtures (build e2e)', () => {
  it.each(INIT_COMMANDS.flatMap(command => FIXTURES.map(fixture => ({
    cliPath: command.cliPath,
    commandLabel: command.commandLabel,
    expectedSrcRoot: fixture.expectedSrcRoot,
    fixtureLabel: fixture.label,
    sourceRoot: fixture.sourceRoot,
    caseLabel: `${command.commandLabel}:${fixture.label}`,
  }))))('initializes and builds $caseLabel without mutating fixtures', async ({
    cliPath,
    commandLabel,
    expectedSrcRoot,
    fixtureLabel,
    sourceRoot,
  }) => {
    const before = await collectFileSnapshot(sourceRoot)
    const projectRoot = await createFixtureCopy(fixtureLabel, sourceRoot, commandLabel)

    await runInit(projectRoot, cliPath)
    await expectInitializedProject(projectRoot, expectedSrcRoot)

    await runWeappViteBuildWithLogCapture({
      cliPath: WEAPP_VITE_CLI_PATH,
      projectRoot,
      platform: 'weapp',
      cwd: projectRoot,
      label: `ci:init-native:${commandLabel}:${fixtureLabel}`,
      skipNpm: true,
    })
    await expectBuildOutput(projectRoot)

    await expect(collectFileSnapshot(sourceRoot)).resolves.toEqual(before)
  })
})
