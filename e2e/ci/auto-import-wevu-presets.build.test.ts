/* eslint-disable e18e/ban-dependencies */
import fs from 'node:fs/promises'
import { execa } from 'execa'
import path from 'pathe'
import { expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../../e2e-apps/auto-import-wevu-presets')
it('builds an app using wevu auto-import presets', async () => {
  await execa('pnpm', ['--filter', 'weapp-vite', 'build'], { cwd: path.resolve(root, '../..') })
  await execa('pnpm', ['build'], { cwd: root, stdio: 'inherit' })
  const dts = await fs.readFile(path.join(root, 'src/auto-imports.d.ts'), 'utf8')
  expect(dts).toContain('from \'wevu\'')
  expect(dts).toContain('from \'wevu/router\'')
  expect(await fs.stat(path.join(root, 'dist/pages/index/index.js'))).toBeTruthy()
})
