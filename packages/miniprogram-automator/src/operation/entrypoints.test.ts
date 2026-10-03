import { access } from 'node:fs/promises'
import { expect, it } from 'vitest'
import packageJson from '../../package.json'

it('ships both operation entry files and shares its class with the main published entry', async () => {
  const root = new URL('../../', import.meta.url)
  const entry = packageJson.exports['./operation']
  await Promise.all([entry.import, entry.types].map(file => access(new URL(file, root))))
  const [main, operation] = await Promise.all([
    import(new URL(packageJson.exports['.'].import, root).href),
    import(new URL(entry.import, root).href),
  ])
  expect(main.OperationLifecycle).toBe(operation.OperationLifecycle)
  expect(main.readWechatLoginState).toBe(operation.readWechatLoginState)
  expect(new operation.OperationLifecycle(100, 'consumer')).toBeInstanceOf(main.OperationLifecycle)
})
