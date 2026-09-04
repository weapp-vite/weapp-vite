import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { waitForFileContains } from '../utils/hmr-helpers'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.resolve(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const SOURCE_APP_ROOT = path.resolve(REPO_ROOT, 'e2e-apps/stateful-hmr')
const TMP_ROOT = path.resolve(REPO_ROOT, '.tmp')
const STYLE_MARKER = 'issue-896-style-marker'

async function createIssue896Fixture() {
  await fs.ensureDir(TMP_ROOT)
  const fixtureRoot = await mkdtemp(path.join(TMP_ROOT, 'issue-896-stateful-'))
  await fs.copy(SOURCE_APP_ROOT, fixtureRoot, {
    filter: (source) => {
      const relativePath = path.relative(SOURCE_APP_ROOT, source)
      return relativePath !== 'dist' && !relativePath.startsWith(`dist${path.sep}`)
    },
  })

  const configPath = path.join(fixtureRoot, 'weapp-vite.config.ts')
  const config = await fs.readFile(configPath, 'utf8')
  await fs.writeFile(
    configPath,
    config.replace(
      'hmr: {\n      logLevel: \'verbose\',\n    },',
      'hmr: {\n      runtime: \'stateful-experimental\',\n      logLevel: \'verbose\',\n    },',
    ),
    'utf8',
  )

  const pagePath = path.join(fixtureRoot, 'src/pages/wevu/index.vue')
  const page = await fs.readFile(pagePath, 'utf8')
  await fs.writeFile(
    pagePath,
    page.replace(/<style>[\s\S]*?<\/style>/, '<style src="./index.scss" lang="scss"></style>'),
    'utf8',
  )
  await fs.writeFile(
    path.join(fixtureRoot, 'src/pages/wevu/index.scss'),
    `.${STYLE_MARKER} { color: #893a6d; }\n`,
    'utf8',
  )
  return fixtureRoot
}

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe('issue #896 stateful initial build', { concurrent: false }, () => {
  it('compiles TypeScript SFC and style sidecars and reaches a ready output', async () => {
    const fixtureRoot = await createIssue896Fixture()
    const outputPath = path.join(fixtureRoot, 'dist/pages/wevu/index.wxss')
    const dev = startDevProcess(process.execPath, [
      CLI_PATH,
      'dev',
      fixtureRoot,
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      all: true,
      cwd: fixtureRoot,
      env: createDevProcessEnv(),
      reject: false,
    })

    try {
      const style = await dev.waitFor(
        waitForFileContains(outputPath, STYLE_MARKER, 60_000),
        'issue #896 stateful initial style output',
      )
      expect(style).toContain('#893a6d')
      expect(await fs.pathExists(path.join(fixtureRoot, 'dist/app.js'))).toBe(true)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(fixtureRoot)
    }
  }, 120_000)
})
