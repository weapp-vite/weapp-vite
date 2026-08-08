import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectExternalComponentOptimizeDeps } from './dependencyScan'

describe('外部组件 Web 依赖扫描', () => {
  it('递归跟随相对脚本并只返回裸模块依赖', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-component-deps-'))
    const componentPath = join(root, 'component.js')
    const secondComponentPath = join(root, 'second-component.js')
    const localePath = join(root, 'locale.js')
    await mkdir(root, { recursive: true })
    await writeFile(componentPath, 'import \'./locale.js\'\nimport helper from \'demo-helper\'\nvoid helper')
    await writeFile(secondComponentPath, 'import \'second-helper\'')
    await writeFile(localePath, 'import \'dayjs/locale/zh-cn\'\nimport \'demo-component\'')

    await expect(collectExternalComponentOptimizeDeps([
      {
        id: '__external__/demo-component',
        importId: 'demo-component',
        script: componentPath,
      },
      {
        id: '__external__/second-component',
        importId: 'second-component',
        script: secondComponentPath,
      },
    ])).resolves.toEqual([
      'dayjs/locale/zh-cn',
      'demo-helper',
      'second-helper',
    ])
  })
})
