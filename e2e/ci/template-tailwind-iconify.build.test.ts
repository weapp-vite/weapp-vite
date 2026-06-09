import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.resolve(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-template')
const TMP_ROOT = path.resolve(REPO_ROOT, '.tmp')

async function createTemplateFixture() {
  await fs.ensureDir(TMP_ROOT)
  const fixtureRoot = await mkdtemp(path.join(TMP_ROOT, 'template-tailwind-iconify-'))
  await fs.copy(TEMPLATE_ROOT, fixtureRoot, {
    filter: (source) => {
      const relativePath = path.relative(TEMPLATE_ROOT, source)
      return relativePath !== 'dist' && !relativePath.startsWith(`dist${path.sep}`)
    },
  })
  return fixtureRoot
}

describe.sequential('template: Tailwind CSS Iconify build output', () => {
  let fixtureRoot: string

  beforeAll(async () => {
    fixtureRoot = await createTemplateFixture()

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: fixtureRoot,
      platform: 'weapp',
      cwd: fixtureRoot,
      label: 'ci:template-tailwind-iconify',
    })
  }, 120_000)

  afterAll(async () => {
    if (fixtureRoot) {
      await fs.remove(fixtureRoot)
    }
  })

  it('keeps Iconify base mask rules for i-mdi utility icons', async () => {
    const appWxss = await fs.readFile(path.join(fixtureRoot, 'dist/app.wxss'), 'utf8')
    const indexWxml = await fs.readFile(path.join(fixtureRoot, 'dist/pages/index/index.wxml'), 'utf8')

    expect(indexWxml).toContain('iconify')
    expect(indexWxml).toContain('i-mdi-moon-waxing-crescent')
    expect(indexWxml).toContain('i-mdi-weather-sunny')
    expect(appWxss).toContain('.iconify')
    expect(appWxss).toContain('width: 1em')
    expect(appWxss).toContain('height: 1em')
    expect(appWxss).toContain('background-color: currentColor')
    expect(appWxss).toContain('mask-image: var(--svg)')
    expect(appWxss).toContain('.i-mdi-moon-waxing-crescent')
    expect(appWxss).toContain('.i-mdi-weather-sunny')
  })
})
