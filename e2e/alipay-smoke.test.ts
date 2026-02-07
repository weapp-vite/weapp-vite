import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/base')
const RUNTIME_APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/wevu-runtime-e2e')

async function runAlipayBuild(root: string) {
  await execa('node', [CLI_PATH, 'build', root, '--platform', 'alipay', '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('alipay e2e smoke', () => {
  it('builds base app with alipay template/script outputs', async () => {
    const outputRoot = path.join(BASE_APP_ROOT, 'dist')
    await fs.remove(outputRoot)

    await runAlipayBuild(BASE_APP_ROOT)

    const templateFile = path.join(outputRoot, 'pages/index/index.axml')
    const scriptFile = path.join(outputRoot, 'pages/index/utils.sjs')

    expect(await fs.pathExists(templateFile)).toBe(true)
    expect(await fs.pathExists(scriptFile)).toBe(true)

    const templateContent = await fs.readFile(templateFile, 'utf8')
    expect(templateContent).toContain('./card.axml')
    expect(templateContent).toContain('onTap')
    expect(templateContent).toContain('<import-sjs')
    expect(templateContent).toContain('./utils.sjs')
  })

  it('builds wevu runtime app with alipay page assets', async () => {
    const distRoot = path.join(RUNTIME_APP_ROOT, 'dist')
    await fs.remove(distRoot)

    await runAlipayBuild(RUNTIME_APP_ROOT)

    const appJsonPath = path.join(distRoot, 'app.json')
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const appConfig = await fs.readJson(appJsonPath)
    const pages = Array.isArray(appConfig.pages) ? appConfig.pages : []
    expect(pages.length).toBeGreaterThan(0)

    const firstPage = pages[0]
    const pageTemplatePath = path.join(distRoot, `${firstPage}.axml`)
    const pageStylePath = path.join(distRoot, `${firstPage}.acss`)
    expect(await fs.pathExists(pageTemplatePath)).toBe(true)
    expect(await fs.pathExists(pageStylePath)).toBe(true)

    const runtimeSjsPath = path.join(distRoot, '__weapp_vite_class_style.sjs')
    expect(await fs.pathExists(runtimeSjsPath)).toBe(true)

    const styleMatrixTemplatePath = path.join(distRoot, 'pages/style-matrix/index.axml')
    expect(await fs.pathExists(styleMatrixTemplatePath)).toBe(true)

    const styleMatrixTemplateContent = await fs.readFile(styleMatrixTemplatePath, 'utf8')
    expect(styleMatrixTemplateContent).toContain('<import-sjs')
    expect(styleMatrixTemplateContent).toContain('__weapp_vite_class_style.sjs')
  })
})
