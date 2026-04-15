import { fs } from '@weapp-core/shared'
// eslint-disable-next-line e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-vue-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
    cwd: APP_ROOT,
  })
}

describe.sequential('e2e app: wevu-vue-demo (script setup macros mapping)', () => {
  it('maps defineProps/withDefaults/defineEmits/defineExpose and imported components to mini-program outputs', async () => {
    await runBuild()

    const pageJsonPath = path.join(DIST_ROOT, 'pages/vue-compat/script-setup/index.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/vue-compat/script-setup/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/vue-compat/script-setup/index.js')
    const panelJsonPath = path.join(DIST_ROOT, 'pages/vue-compat/components/CompatPanel.json')
    const panelJsPath = path.join(DIST_ROOT, 'pages/vue-compat/components/CompatPanel.js')
    const altPanelJsonPath = path.join(DIST_ROOT, 'pages/vue-compat/components/CompatAltPanel.json')
    const altPanelJsPath = path.join(DIST_ROOT, 'pages/vue-compat/components/CompatAltPanel.js')
    const modelInputJsPath = path.join(DIST_ROOT, 'pages/vue-compat/components/ModelInput.js')

    const pageJson = await fs.readJson(pageJsonPath)
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const panelJson = await fs.readJson(panelJsonPath)
    const panelJs = await fs.readFile(panelJsPath, 'utf-8')
    const altPanelJson = await fs.readJson(altPanelJsonPath)
    const altPanelJs = await fs.readFile(altPanelJsPath, 'utf-8')
    const modelInputJs = await fs.readFile(modelInputJsPath, 'utf-8')

    expect(pageJson.usingComponents).toMatchObject({
      NativeBadge: '/native/native-badge/index',
      NativeMeterTs: '/native/native-meter-ts/index',
      CompatPanel: '/pages/vue-compat/components/CompatPanel',
      CompatAltPanel: '/pages/vue-compat/components/CompatAltPanel',
      ModelInput: '/pages/vue-compat/components/ModelInput',
    })

    expect(pageWxml).toContain('<NativeBadge')
    expect(pageWxml).toContain('<NativeMeterTs')
    expect(pageWxml).toContain('<CompatPanel')
    expect(pageWxml).toContain('<CompatAltPanel')
    expect(pageWxml).toContain('bindrun="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindrunevent="__weapp_vite_inline"')
    expect(pageWxml).toContain('data-wd-run="1"')
    expect(pageWxml).toContain('data-wd-runevent="1"')

    expect(pageJs).toMatch(/__weappViteUsingComponent:\s*true/)
    expect(pageJs).toMatch(/name:\s*['"`]NativeBadge['"`],\s*from:\s*['"`]\/native\/native-badge\/index['"`]/)
    expect(pageJs).toMatch(/name:\s*['"`]CompatPanel['"`],\s*from:\s*['"`]\/pages\/vue-compat\/components\/CompatPanel['"`]/)
    expect(pageJs).toMatch(/name:\s*['"`]CompatAltPanel['"`],\s*from:\s*['"`]\/pages\/vue-compat\/components\/CompatAltPanel['"`]/)

    expect(panelJson.component).toBe(true)
    expect(altPanelJson.component).toBe(true)

    expect(panelJs).toMatch(/props:\s*\{\s*title:\s*\{\s*type:\s*String,\s*required:\s*true\s*\}/)
    expect(panelJs).toMatch(/description:\s*\{\s*type:\s*String,\s*required:\s*false,\s*default:\s*(?:``|""|'')\s*\}/)
    expect(panelJs).toMatch(/tone:\s*\{\s*type:\s*String,\s*required:\s*false,\s*default:\s*['"`]neutral['"`]\s*\}/)
    expect(panelJs).toMatch(/emits:\s*\[\s*['"`]run['"`]\s*\]/)
    expect(panelJs).toContain('setup(__props, { expose, emit: __emit })')
    expect(panelJs).toMatch(/expose\(\{\s*run\s*\}\)/)

    expect(altPanelJs).toMatch(/props:\s*\{\s*title:\s*\{\s*type:\s*String,\s*required:\s*true\s*\}\s*\}/)
    expect(altPanelJs).toMatch(/emits:\s*\[\s*['"`]run['"`],\s*['"`]runevent['"`]\s*\]/)
    expect(altPanelJs).toContain('emit run payload')
    expect(altPanelJs).toContain('emit runevent payload')

    expect(modelInputJs).toContain('mergeModels({ label:')
    expect(modelInputJs).toMatch(/label:\s*\{\s*type:\s*String,\s*required:\s*false,\s*default:\s*['"`]Model Input['"`]\s*\}/)
    expect(modelInputJs).toMatch(/emits:\s*\[\s*['"`]update:modelValue['"`]\s*\]/)
  })
})
