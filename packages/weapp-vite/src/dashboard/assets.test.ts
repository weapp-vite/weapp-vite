import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { resolveDashboardClientAssets, resolveDashboardRoot } from './assets'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

it('locates only built SPA assets while standalone watch prefers the optional source config', async () => {
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-assets-')))
  temporaryRoots.push(cwd)
  const packageRoot = path.join(cwd, 'node_modules', '@weapp-vite', 'dashboard')
  const clientRoot = path.join(packageRoot, 'client')
  await fs.mkdir(clientRoot, { recursive: true })
  await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: '@weapp-vite/dashboard',
    weappViteDashboard: { devRoot: '.', devConfigFile: 'vite.config.ts', distDir: 'client' },
  }))
  await fs.writeFile(path.join(packageRoot, 'vite.config.ts'), 'export default {}')
  expect(resolveDashboardClientAssets(cwd)).toBeUndefined()
  expect(resolveDashboardRoot({ cwd, watch: true })).toEqual({ root: packageRoot, configFile: path.join(packageRoot, 'vite.config.ts') })

  await fs.writeFile(path.join(clientRoot, 'index.html'), '<html><body>Dashboard asset fixture</body></html>')
  expect(resolveDashboardClientAssets(cwd)).toBe(clientRoot)
  expect(resolveDashboardRoot({ cwd })).toEqual({ root: clientRoot })
  expect(resolveDashboardRoot({ cwd, watch: true })).toEqual({ root: packageRoot, configFile: path.join(packageRoot, 'vite.config.ts') })
})
