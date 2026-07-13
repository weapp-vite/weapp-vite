import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.resolve(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const TMP_ROOT = path.resolve(REPO_ROOT, '.tmp')
const TEMPLATE_CASES = [
  {
    name: 'weapp-vite-tailwindcss-template',
    root: path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-template'),
  },
  {
    name: 'weapp-vite-tailwindcss-vant-template',
    root: path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-vant-template'),
  },
  {
    name: 'weapp-vite-tailwindcss-tdesign-template',
    root: path.resolve(REPO_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template'),
  },
] as const

async function createTemplateFixture(templateRoot: string, templateName: string) {
  await fs.ensureDir(TMP_ROOT)
  const fixtureRoot = await mkdtemp(path.join(TMP_ROOT, `${templateName}-iconify-`))
  await fs.copy(templateRoot, fixtureRoot, {
    filter: (source) => {
      const relativePath = path.relative(templateRoot, source)
      return relativePath !== 'dist' && !relativePath.startsWith(`dist${path.sep}`)
    },
  })
  return fixtureRoot
}

describe.sequential('template: Tailwind CSS Iconify build output', () => {
  const fixtureRoots: string[] = []

  afterAll(async () => {
    await Promise.all(fixtureRoots.map(async fixtureRoot => await fs.remove(fixtureRoot)))
  })

  it.each(TEMPLATE_CASES)('keeps Iconify rules and native layout branches in $name', async (templateCase) => {
    const fixtureRoot = await createTemplateFixture(templateCase.root, templateCase.name)
    fixtureRoots.push(fixtureRoot)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: fixtureRoot,
      platform: 'weapp',
      cwd: fixtureRoot,
      label: `ci:template-tailwind-iconify:${templateCase.name}`,
    })

    const appWxss = await fs.readFile(path.join(fixtureRoot, 'dist/app.wxss'), 'utf8')
    const indexWxml = await fs.readFile(path.join(fixtureRoot, 'dist/pages/index/index.wxml'), 'utf8')
    const layoutWxml = await fs.readFile(path.join(fixtureRoot, 'dist/pages/layouts/index.wxml'), 'utf8')

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
    expect(layoutWxml).toContain('<weapp-layout-default')
    expect(layoutWxml).toContain('<weapp-layout-admin')
    expect(layoutWxml).toContain('<block wx:else>')
    expect(layoutWxml).toContain('tracking-_b0_d2em_B')
  }, 120_000)
})
