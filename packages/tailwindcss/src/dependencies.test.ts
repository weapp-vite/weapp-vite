import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('depends on the shared HMR contract and upstream core without importing a host or native engine', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies: Record<string, string> }
  expect(manifest.dependencies).toHaveProperty('@weapp-vite/hmr')
  expect(manifest.dependencies).toHaveProperty('weapp-tailwindcss')
  expect(Object.keys(manifest.dependencies).filter(name => /^(?:weapp-vite|wevu|vite|rolldown|react|@tarojs\/)$/.test(name))).toEqual([])
})
