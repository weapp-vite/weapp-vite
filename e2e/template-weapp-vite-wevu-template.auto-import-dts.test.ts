import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/src/cli.ts')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../templates/weapp-vite-wevu-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const COMPONENTS_DTS = path.join(TEMPLATE_ROOT, 'components.d.ts')
const TYPED_COMPONENTS_DTS = path.join(TEMPLATE_ROOT, 'typed-components.d.ts')

async function runBuild(root: string) {
  await execa('node', ['--import', 'tsx', CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('template e2e: weapp-vite-wevu-template auto-import dts', () => {
  it('emits source-navigation friendly components.d.ts and typed props', async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(COMPONENTS_DTS)
    await fs.remove(TYPED_COMPONENTS_DTS)

    await runBuild(TEMPLATE_ROOT)

    const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
    expect(await fs.pathExists(pageJsonPath)).toBe(true)

    const pageJson = await fs.readJson(pageJsonPath)
    expect(pageJson.usingComponents).toMatchObject({
      HelloWorld: '/components/HelloWorld/index',
    })

    expect(await fs.pathExists(COMPONENTS_DTS)).toBe(true)
    expect(await fs.pathExists(TYPED_COMPONENTS_DTS)).toBe(true)

    const componentsDts = await fs.readFile(COMPONENTS_DTS, 'utf8')
    expect(componentsDts).toContain('declare module \'wevu\'')
    expect(componentsDts).toContain('typeof import("./src/components/HelloWorld/index.vue")')
    expect(componentsDts).toContain('ComponentProp<"HelloWorld">')

    const typedDts = await fs.readFile(TYPED_COMPONENTS_DTS, 'utf8')
    expect(typedDts).toContain('declare module \'weapp-vite/typed-components\'')
    expect(typedDts).toContain('HelloWorld: {')
    expect(typedDts).toContain('readonly title?: string;')
    expect(typedDts).toContain('readonly subtitle?: string;')
  })
})
