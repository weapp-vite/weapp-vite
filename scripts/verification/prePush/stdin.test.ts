import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 通过子进程 stdin 验证原生 hook 接口，不启动实际验证任务。
import { execa } from 'execa'
import { expect, it } from 'vitest'

const entry = fileURLToPath(new URL('./index.ts', import.meta.url))
const root = fileURLToPath(new URL('../../../', import.meta.url))
const zero = '0'.repeat(40)
const old = 'a'.repeat(40)

it('consumes native pre-push stdin for every ref instead of verifying the current HEAD', async () => {
  const result = await execa(process.execPath, ['--import', 'tsx', entry, 'origin', 'https://example.invalid/project.git'], {
    cwd: root,
    input: `(delete) ${zero} refs/heads/one ${old}\n(delete) ${zero} refs/heads/two ${old}\n`,
  })
  expect(result.stdout).toContain('没有需要验证的候选提交')
})

it('fails closed when stdin does not contain native four-column records', async () => {
  const result = await execa(process.execPath, ['--import', 'tsx', entry, 'origin', 'https://example.invalid/project.git'], {
    cwd: root,
    input: 'refs/heads/feature\n',
    reject: false,
  })
  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain('Git 原生的四列引用输入')
})
