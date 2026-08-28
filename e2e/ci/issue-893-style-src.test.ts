import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { disableProjectCompileHotReload, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.resolve(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const SOURCE_APP_ROOT = path.resolve(REPO_ROOT, 'e2e-apps/issue-814-tailwind4')
const TMP_ROOT = path.resolve(REPO_ROOT, '.tmp')
const INITIAL_BASE_COLOR = '#893a6d'
const UPDATED_BASE_COLOR = '#398a6d'

async function createIssue893Fixture() {
  await fs.ensureDir(TMP_ROOT)
  const fixtureRoot = await mkdtemp(path.join(TMP_ROOT, 'issue-893-style-src-'))
  await fs.copy(SOURCE_APP_ROOT, fixtureRoot, {
    filter: (source) => {
      const relativePath = path.relative(SOURCE_APP_ROOT, source)
      return relativePath !== 'dist' && !relativePath.startsWith(`dist${path.sep}`)
    },
  })
  const appVuePath = path.join(fixtureRoot, 'src/app.vue')
  const appVue = await fs.readFile(appVuePath, 'utf8')
  await fs.writeFile(
    appVuePath,
    appVue.replace(
      '<style src="./app.css"></style>',
      '<style src="./issue-893-base.scss" lang="scss"></style>\n\n<style src="./app.css"></style>',
    ),
    'utf8',
  )
  await fs.writeFile(
    path.join(fixtureRoot, 'src/issue-893-base.scss'),
    '$issue-893-color: #893a6d;\n\n.issue-893-base {\n  color: $issue-893-color;\n}\n',
    'utf8',
  )
  return fixtureRoot
}

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('issue #893 multiple app style src assets', () => {
  it('keeps author Sass and Tailwind utilities in production app.wxss', async () => {
    const fixtureRoot = await createIssue893Fixture()
    try {
      await runWeappViteBuildWithLogCapture({
        cliPath: CLI_PATH,
        projectRoot: fixtureRoot,
        platform: 'weapp',
        cwd: fixtureRoot,
        label: 'ci:issue-893-style-src',
      })

      const appWxss = await fs.readFile(path.join(fixtureRoot, 'dist/app.wxss'), 'utf8')
      expect(appWxss).toContain('.issue-893-base')
      expect(appWxss).toContain(INITIAL_BASE_COLOR)
      expect(appWxss).toMatch(/\.flex\s*\{/)
      expect(appWxss).toContain('display: flex')
    }
    finally {
      await fs.remove(fixtureRoot)
    }
  }, 120_000)

  it('preserves author Sass and Tailwind utilities after dev style updates', async () => {
    const fixtureRoot = await createIssue893Fixture()
    const sourceFile = path.join(fixtureRoot, 'src/issue-893-base.scss')
    const outputFile = path.join(fixtureRoot, 'dist/app.wxss')
    await disableProjectCompileHotReload(fixtureRoot)
    const dev = startDevProcess('node', [CLI_PATH, 'dev', fixtureRoot, '--platform', 'weapp'], {
      cwd: fixtureRoot,
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      const initialCss = await dev.waitFor(
        waitForFileContains(outputFile, INITIAL_BASE_COLOR),
        'issue #893 initial author Sass',
      )
      expect(initialCss).toMatch(/\.flex\s*\{/)

      const source = await fs.readFile(sourceFile, 'utf8')
      const updatedSource = source.replace(INITIAL_BASE_COLOR, UPDATED_BASE_COLOR)
      expect(updatedSource).not.toBe(source)
      await replaceFileByRename(sourceFile, updatedSource)

      const updatedCss = await dev.waitFor(
        waitForFileContains(outputFile, UPDATED_BASE_COLOR),
        'issue #893 updated author Sass',
      )
      expect(updatedCss).toMatch(/\.flex\s*\{/)
      expect(updatedCss).toContain('display: flex')
    }
    finally {
      await dev.stop(3_000)
      await fs.remove(fixtureRoot)
    }
  }, 180_000)
})
