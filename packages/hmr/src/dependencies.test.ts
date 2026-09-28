import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('has no runtime dependency on a framework, Tailwind, Vite or a second Rolldown engine', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies: Record<string, string> }
  expect(Object.keys(manifest.dependencies).filter(name => /^(?:weapp-vite|wevu|vite|rolldown|weapp-tailwindcss|react|@tarojs\/)/.test(name))).toEqual([])
})
