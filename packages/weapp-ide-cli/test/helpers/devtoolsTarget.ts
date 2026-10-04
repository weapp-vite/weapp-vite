import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'

export function createPackageAsar(metadata: Record<string, unknown>, entryOverride: Record<string, unknown> = {}) {
  const content = Buffer.from(JSON.stringify(metadata))
  const header = Buffer.from(JSON.stringify({ files: { 'package.json': { size: content.length, offset: '0', ...entryOverride } } }))
  const paddedSize = Math.ceil(header.length / 4) * 4
  const prefix = Buffer.alloc(16 + paddedSize)
  prefix.writeUInt32LE(4, 0)
  prefix.writeUInt32LE(8 + paddedSize, 4)
  prefix.writeUInt32LE(4 + paddedSize, 8)
  prefix.writeUInt32LE(header.length, 12)
  header.copy(prefix, 16)
  return Buffer.concat([prefix, content])
}

export async function createDevtoolsInstallation(root: string, options: { name?: string, platform?: 'darwin' | 'win32', legacy?: boolean, version?: string, versionType?: string } = {}) {
  const platform = options.platform ?? 'darwin'
  const application = path.join(root, options.name ?? 'selected.app')
  const cliPath = platform === 'darwin' ? path.join(application, 'Contents', 'MacOS', 'cli') : path.join(application, 'cli.bat')
  const resources = platform === 'darwin' ? path.join(application, 'Contents', 'Resources') : path.join(application, 'resources')
  const appPath = options.legacy
    ? path.join(platform === 'win32' ? application : resources, 'package.nw')
    : path.join(resources, 'app.asar')
  await fs.mkdir(path.dirname(cliPath), { recursive: true })
  await fs.mkdir(path.dirname(appPath), { recursive: true })
  await fs.writeFile(cliPath, 'fixture CLI; never executed')
  const metadata = { name: '微信开发者工具', version: options.version ?? '2.02.2608080', versionType: options.versionType ?? '0' }
  if (options.legacy) {
    await fs.mkdir(appPath, { recursive: true })
    await fs.writeFile(path.join(appPath, 'package.json'), JSON.stringify(metadata))
  }
  else {
    await fs.writeFile(appPath, createPackageAsar(metadata))
  }
  return { cliPath, appPath, application }
}
