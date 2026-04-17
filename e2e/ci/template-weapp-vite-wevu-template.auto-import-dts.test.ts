/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/src/cli.ts')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const INTERNAL_OUTPUT_ROOT = path.join(TEMPLATE_ROOT, '.weapp-vite')
const COMPONENTS_DTS = path.join(INTERNAL_OUTPUT_ROOT, 'components.d.ts')
const TYPED_COMPONENTS_DTS = path.join(INTERNAL_OUTPUT_ROOT, 'typed-components.d.ts')

async function runBuild(root: string) {
  await execa('node', ['--import', 'tsx', CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('template e2e: weapp-vite-wevu-template auto-import dts', () => {
  it('does not emit default support dts files during production build', async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(COMPONENTS_DTS)
    await fs.remove(TYPED_COMPONENTS_DTS)

    await runBuild(TEMPLATE_ROOT)

    const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
    expect(await fs.pathExists(pageJsonPath)).toBe(true)

    const pageJson = await fs.readJson(pageJsonPath)
    expect(pageJson.usingComponents).toMatchObject({
      InfoPanel: '/components/InfoPanel/index',
      StatusPill: '/components/StatusPill/index',
    })

    expect(await fs.pathExists(COMPONENTS_DTS)).toBe(false)
    expect(await fs.pathExists(TYPED_COMPONENTS_DTS)).toBe(false)
  })
})
