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
    const abilityPageWxml = await readDistFile(BASE_TEMPLATE_ROOT, 'pages/ability/index.wxml')
    const layoutPageWxml = await readDistFile(BASE_TEMPLATE_ROOT, 'pages/layouts/index.wxml')
    const defaultLayoutJs = await readDistFile(BASE_TEMPLATE_ROOT, 'layouts/default.js')
    const adminLayoutJs = await readDistFile(BASE_TEMPLATE_ROOT, 'layouts/admin.js')

    expect(defaultLayoutWxml).toContain('<t-toast id="t-toast" />')
    expect(defaultLayoutWxml).toContain('<t-dialog id="t-dialog" />')
    expect(adminLayoutWxml).toContain('<t-toast id="t-toast" />')
    expect(adminLayoutWxml).toContain('<t-dialog id="t-dialog" />')
    expectNoFeedbackNodes(pageWxml)
    expectNoFeedbackNodes(abilityPageWxml)
    expect(layoutPageWxml).toContain('<t-toast id="t-toast" />')
    expect(defaultLayoutJs).toContain('setup(')
    expect(adminLayoutJs).toContain('setup(')
  })

  it('emits shared feedback nodes from the retail default layout only', async () => {
    const defaultLayoutWxml = await readDistFile(RETAIL_TEMPLATE_ROOT, 'layouts/default.wxml')
    const cartPageWxml = await readDistFile(RETAIL_TEMPLATE_ROOT, 'pages/cart/index.wxml')
    const orderButtonBarWxml = await readDistFile(RETAIL_TEMPLATE_ROOT, 'pages/order/components/order-button-bar/index.wxml')

    expect(defaultLayoutWxml).toContain('<t-toast id="t-toast" />')
    expect(defaultLayoutWxml).toContain('<t-dialog id="t-dialog" />')
    expectNoFeedbackNodes(cartPageWxml)
    expectNoFeedbackNodes(orderButtonBarWxml)
  })
})
