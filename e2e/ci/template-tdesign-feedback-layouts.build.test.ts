import { readFile } from 'node:fs/promises'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const RETAIL_TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')

async function buildTemplate(projectRoot: string, label: string) {
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label,
  })
}

async function readDistFile(projectRoot: string, relativePath: string) {
  return await readFile(path.join(projectRoot, 'dist', relativePath), 'utf-8')
}

function expectFeedbackNodes(wxml: string) {
  expect(wxml).toContain('<t-toast id="t-toast" />')
  expect(wxml).toContain('<t-dialog id="t-dialog" />')
}

function expectNoFeedbackNodes(wxml: string) {
  expect(wxml).not.toContain('<t-toast')
  expect(wxml).not.toContain('<t-dialog')
}

describe.sequential('template build: tdesign feedback layouts', () => {
  beforeAll(async () => {
    await buildTemplate(BASE_TEMPLATE_ROOT, 'ci:tdesign-feedback-layouts:base')
    await buildTemplate(RETAIL_TEMPLATE_ROOT, 'ci:tdesign-feedback-layouts:retail')
  }, 120_000)

  it('emits shared feedback nodes from the base template layouts', async () => {
    const defaultLayoutWxml = await readDistFile(BASE_TEMPLATE_ROOT, 'layouts/default.wxml')
    const adminLayoutWxml = await readDistFile(BASE_TEMPLATE_ROOT, 'layouts/admin.wxml')
    const pageWxml = await readDistFile(BASE_TEMPLATE_ROOT, 'pages/index/index.wxml')
    const defaultLayoutJs = await readDistFile(BASE_TEMPLATE_ROOT, 'layouts/default.js')
    const adminLayoutJs = await readDistFile(BASE_TEMPLATE_ROOT, 'layouts/admin.js')
    const commonJs = await readDistFile(BASE_TEMPLATE_ROOT, 'common.js')

    expectFeedbackNodes(defaultLayoutWxml)
    expectFeedbackNodes(adminLayoutWxml)
    expectNoFeedbackNodes(pageWxml)
    expect(defaultLayoutJs.trim()).toBe('Component({})')
    expect(adminLayoutJs).toContain('setup(')
    expect(commonJs).not.toContain('//#region src/layouts/default.vue')
  })

  it('emits shared feedback nodes from the retail default layout only', async () => {
    const defaultLayoutWxml = await readDistFile(RETAIL_TEMPLATE_ROOT, 'layouts/default.wxml')
    const cartPageWxml = await readDistFile(RETAIL_TEMPLATE_ROOT, 'pages/cart/index.wxml')

    expectFeedbackNodes(defaultLayoutWxml)
    expectNoFeedbackNodes(cartPageWxml)
  })
})
