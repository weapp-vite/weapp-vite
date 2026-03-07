import { execa } from 'execa'
import fs from 'fs-extra'
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
    expect(pageWxml).toContain('data-wv-event-detail-run="1"')
    expect(pageWxml).toContain('data-wv-event-detail-runevent="1"')

    expect(pageJs).toContain('__weappViteUsingComponent:!0')
    expect(pageJs).toContain('name:`NativeBadge`,from:`/native/native-badge/index`')
    expect(pageJs).toContain('name:`CompatPanel`,from:`/pages/vue-compat/components/CompatPanel`')
    expect(pageJs).toContain('name:`CompatAltPanel`,from:`/pages/vue-compat/components/CompatAltPanel`')

    expect(panelJson.component).toBe(true)
    expect(altPanelJson.component).toBe(true)

    expect(panelJs).toContain('props:{title:{type:String,required:!0}')
    expect(panelJs).toMatch(/description:\{type:String,required:!1,default:(``|""|'')\}/)
    expect(panelJs).toMatch(/tone:\{type:String,required:!1,default:[`'"]neutral[`'"]\}/)
    expect(panelJs).toContain('emits:[`run`]')
    expect(panelJs).toMatch(/setup\([^)]*\{expose:[^,}]+,emit:[^}]+\}\)/)
    expect(panelJs).toMatch(/\w+\(\{run:\w+\}\)/)

    expect(altPanelJs).toContain('props:{title:{type:String,required:!0}}')
    expect(altPanelJs).toContain('emits:[`run`,`runevent`]')
    expect(altPanelJs).toContain('emit run payload')
    expect(altPanelJs).toContain('emit runevent payload')

    expect(modelInputJs).toMatch(/props:e\.\w+\(\{label:\{type:String,required:!1,default:`Model Input`\}/)
    expect(modelInputJs).toContain('emits:[`update:modelValue`]')
  })
})
