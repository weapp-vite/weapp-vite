/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared'
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

describe.sequential('e2e app: wevu-vue-demo (script setup emit compat)', () => {
  it('compiles component emits with Vue-style payload handler semantics', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/vue-compat/script-setup/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/vue-compat/script-setup/index.js')
    const panelJsPath = path.join(DIST_ROOT, 'pages/vue-compat/components/CompatPanel.js')
    const altPanelJsPath = path.join(DIST_ROOT, 'pages/vue-compat/components/CompatAltPanel.js')
    const emitMatrixJsPath = path.join(DIST_ROOT, 'pages/vue-compat/components/CompatEmitMatrix.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const panelJs = await fs.readFile(panelJsPath, 'utf-8')
    const altPanelJs = await fs.readFile(altPanelJsPath, 'utf-8')
    const emitMatrixJs = await fs.readFile(emitMatrixJsPath, 'utf-8')

    expect(pageWxml).toContain('<CompatPanel')
    expect(pageWxml).toContain('<CompatAltPanel')
    expect(pageWxml).toContain('bindrun="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindrunevent="__weapp_vite_inline"')
    expect(pageWxml).toContain('data-wv-event-detail-run="1"')
    expect(pageWxml).toContain('data-wv-event-detail-runevent="1"')
    expect(pageWxml).toContain('<CompatEmitMatrix')
    expect(pageWxml).toContain('prefix="emit-direct"')
    expect(pageWxml).toContain('prefix="emit-explicit"')
    expect(pageWxml).toContain('prefix="emit-inline"')
    expect(pageWxml).toContain('bindpayload="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindnative="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindtuple="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindempty="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindoptions="__weapp_vite_inline"')
    expect(pageWxml).toContain('data-wv-event-detail-payload="1"')
    expect(pageWxml).toContain('data-wv-event-detail-native="1"')
    expect(pageWxml).toContain('data-wv-event-detail-tuple="1"')
    expect(pageWxml).toContain('data-wv-event-detail-empty="1"')
    expect(pageWxml).toContain('data-wv-event-detail-options="1"')
    expect(pageWxml).toContain('data-wv-inline-id-run="__wv_inline_')
    expect(pageWxml).toContain('data-wv-inline-id-runevent="__wv_inline_')
    expect(pageWxml).not.toContain('data-wv-inline-id="')
    expect(pageWxml).not.toContain('bindrun="onPanelRun"')

    expect(pageJs).toContain('__weapp_vite_inline_map')
    expect(pageJs).toMatch(/emit:\s*\$\{[^}]+\.title\}\s*@\s*\$\{[^}]+\.at\}/)
    expect(pageJs).toContain('emit $event:')
    expect(pageJs).toContain('onPanelRunEvent')
    expect(pageJs).toContain('payload-direct')
    expect(pageJs).toContain('payload-explicit-$event')
    expect(pageJs).toContain('payload-inline-title')
    expect(pageJs).toContain('tuple-direct')
    expect(pageJs).toContain('empty-direct')
    expect(pageJs).toContain('options-explicit-$event')
    expect(pageJs).toContain('onEmitMatrixPayloadTitle')
    expect(pageJs).toMatch(/onEmitMatrixPayloadTitle\(n\.title\)/)
    expect(pageJs).not.toContain('unknown-title')
    expect(pageJs).not.toContain('unknown-time')

    expect(panelJs).toContain('run')
    expect(panelJs).toMatch(/toISOString\(\)/)
    expect(panelJs).toMatch(/title:/)

    expect(altPanelJs).toContain('run')
    expect(altPanelJs).toContain('runevent')
    expect(altPanelJs).toContain('[CompatAltPanel] emit run payload')
    expect(altPanelJs).toContain('[CompatAltPanel] emit runevent payload')
    expect(altPanelJs).toMatch(/toISOString\(\)/)
    expect(altPanelJs).toMatch(/title:/)

    expect(emitMatrixJs).toContain('i(`tuple`,`alpha`,2,{ok:!0})')
    expect(emitMatrixJs).toContain('i(`empty`)')
    expect(emitMatrixJs).toContain('i(`options`,')
    expect(emitMatrixJs).toContain('bubbles:!0')
    expect(emitMatrixJs).toContain('composed:!0')
    expect(emitMatrixJs).toContain('fn:(e,t,n)=>e.emitNative(n)')
  })
})
