/* eslint-disable e18e/ban-dependencies -- 使用上游工作区的独立依赖执行回归。 */
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'

export async function testUpstream(directory: string) {
  await execa(process.execPath, [path.join(directory, 'fe/node_modules/vitest/vitest.mjs'), 'run', '__tests__/component-generics.spec.js', '__tests__/virtual-host-metadata.spec.js', '__tests__/real-component-lifecycle.spec.js'], {
    cwd: path.join(directory, 'fe/packages/render'),
    stdio: 'inherit',
  })
}
