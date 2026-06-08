import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.resolve(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template')
const TMP_ROOT = path.resolve(REPO_ROOT, '.tmp')
const ARBITRARY_COLOR_CLASS = 'bg-[#83e210]'
const ESCAPED_ARBITRARY_COLOR_CLASS = 'bg-_b_h83e210_B'

async function createTemplateFixture() {
  await fs.ensureDir(TMP_ROOT)
  const fixtureRoot = await mkdtemp(path.join(TMP_ROOT, 'template-tailwind-v4-source-'))
  await fs.copy(TEMPLATE_ROOT, fixtureRoot, {
    filter: (source) => {
      const relativePath = path.relative(TEMPLATE_ROOT, source)
      return relativePath !== 'dist' && !relativePath.startsWith(`dist${path.sep}`)
    },
  })

  const indexWxmlPath = path.join(fixtureRoot, 'src/pages/index/index.wxml')
  const indexWxml = await fs.readFile(indexWxmlPath, 'utf8')
  await fs.writeFile(
    indexWxmlPath,
    indexWxml.replace(
      /mode === 'light'\?'[^']+'/,
      `mode === 'light'?'${ARBITRARY_COLOR_CLASS} text-slate-800'`,
    ),
  )

  return fixtureRoot
}

describe.sequential('template: Tailwind CSS v4 @source build output', () => {
  let fixtureRoot: string

  beforeAll(async () => {
    fixtureRoot = await createTemplateFixture()

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: fixtureRoot,
      platform: 'weapp',
      cwd: fixtureRoot,
      label: 'ci:template-tailwind-v4-source',
    })
  }, 120_000)

  afterAll(async () => {
    if (fixtureRoot) {
      await fs.remove(fixtureRoot)
    }
  })

  it('generates css for arbitrary-value classes inside wxml bindings', async () => {
    const appWxss = await fs.readFile(path.join(fixtureRoot, 'dist/app.wxss'), 'utf8')
    const indexWxml = await fs.readFile(path.join(fixtureRoot, 'dist/pages/index/index.wxml'), 'utf8')

    expect(indexWxml).toContain(ESCAPED_ARBITRARY_COLOR_CLASS)
    expect(appWxss).toContain(`.${ESCAPED_ARBITRARY_COLOR_CLASS}`)
    expect(appWxss).toContain('background-color: #83e210')
  })
})
