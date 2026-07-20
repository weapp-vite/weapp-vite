/* eslint-disable e18e/ban-dependencies -- QuickApp E2E 需要 execa 驱动真实 CLI 与 hap-toolkit。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/quickapp-runtime-e2e')
const OUTPUT_ROOT = path.join(APP_ROOT, 'dist/quickapp')

describe.sequential('QuickApp build backend', () => {
  beforeAll(async () => {
    await fs.remove(OUTPUT_ROOT)
    await execa('node', [
      CLI_PATH,
      'build',
      APP_ROOT,
      '--platform',
      'quickapp',
      '--quickapp-e2e',
    ], {
      stdio: 'inherit',
    })
  })

  it('emits native QuickApp sources and mirrored official E2E tests', async () => {
    await expect(fs.pathExists(path.join(OUTPUT_ROOT, 'src/manifest.json'))).resolves.toBe(true)
    await expect(fs.pathExists(path.join(OUTPUT_ROOT, 'src/app.ux'))).resolves.toBe(true)
    await expect(fs.pathExists(path.join(OUTPUT_ROOT, 'src/native/reactivity/index.ux'))).resolves.toBe(true)
    await expect(fs.pathExists(path.join(OUTPUT_ROOT, 'test/native/reactivity/index.js'))).resolves.toBe(true)
    await expect(fs.pathExists(path.join(OUTPUT_ROOT, 'test/vue/components/index.js'))).resolves.toBe(true)
  })

  it('compiles Vue SFC routes and components directly to QuickApp .ux files', async () => {
    const lifecycle = await fs.readFile(path.join(OUTPUT_ROOT, 'src/vue/lifecycle/index.ux'), 'utf8')
    const api = await fs.readFile(path.join(OUTPUT_ROOT, 'src/vue/api/index.ux'), 'utf8')
    const component = await fs.readFile(path.join(OUTPUT_ROOT, 'src/vue/components/CounterCard.ux'), 'utf8')
    const runtime = await fs.readFile(path.join(OUTPUT_ROOT, 'src/Common/weapp-vite-vue.js'), 'utf8')

    expect(lifecycle).toContain('__quickappBindings: ["lifecycle"]')
    expect(api).toContain('__quickappBindings: ["result", "readDevice"]')
    expect(component).toContain('emit(\'increment\', props.count + 1)')
    expect(runtime).toContain('emit: (name, detail) => this.$emit(name, detail)')
    await expect(fs.pathExists(path.join(OUTPUT_ROOT, 'src/vue/lifecycle/index.vue'))).resolves.toBe(false)
  })

  it('produces a toolkit-compiled bundle and debug RPK without mini-program artifacts', async () => {
    const rpkFiles = (await fs.readdir(path.join(OUTPUT_ROOT, 'dist')))
      .filter(file => file.endsWith('.rpk'))

    expect(rpkFiles).toHaveLength(1)
    await expect(fs.pathExists(path.join(OUTPUT_ROOT, 'build/vue/reactivity/index.js'))).resolves.toBe(true)
    const emittedFiles = await fs.readdir(path.join(OUTPUT_ROOT, 'src/vue/reactivity'))
    expect(emittedFiles.some(file => /\.(?:wxml|wxss|wxs)$/.test(file))).toBe(false)
  })
})
