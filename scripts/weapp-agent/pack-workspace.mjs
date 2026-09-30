import { readFile } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- Preserve cross-platform command resolution, cancellation and process cleanup semantics.
import { execa } from 'execa'

export async function packWorkspace(root, destination) {
  const { stdout } = await execa('pnpm', ['--filter', '@weapp-agent/cli...', '--filter', 'weapp-vite...', 'list', '--depth', '-1', '--json'], { cwd: root })
  const overrides = {}
  for (const pkg of JSON.parse(stdout)) {
    if (pkg.private) {
      continue
    }
    await execa('pnpm', ['pack', '--pack-destination', destination], { cwd: pkg.path, timeout: 120000 })
    const manifest = JSON.parse(await readFile(path.join(pkg.path, 'package.json'), 'utf8'))
    overrides[pkg.name] = path.join(destination, `${pkg.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`)
  }
  return overrides
}
