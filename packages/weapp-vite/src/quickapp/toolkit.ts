import type { ResolvedQuickAppConfig } from './types'
import { mkdir, readdir, readFile, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'
import path from 'pathe'
import { x } from 'tinyexec'

async function findPackageRoot(entryPath: string) {
  let current = path.dirname(entryPath)
  while (current !== path.dirname(current)) {
    const packageJsonPath = path.resolve(current, 'package.json')
    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string }
      if (packageJson.name === 'hap-toolkit') {
        return current
      }
    }
    catch { }
    current = path.dirname(current)
  }
  throw new Error('无法定位 hap-toolkit 包目录。')
}

async function resolveHapBin(cwd: string) {
  const require = createRequire(path.resolve(cwd, 'package.json'))
  let entryPath: string
  try {
    entryPath = require.resolve('hap-toolkit')
  }
  catch {
    throw new Error('QuickApp RPK 构建需要在项目中安装 hap-toolkit，例如：pnpm add -D hap-toolkit@2.1.0')
  }
  return path.resolve(await findPackageRoot(entryPath), 'bin/index.js')
}

async function ensurePnpmVirtualStoreLink(outDir: string, hapBin: string) {
  const marker = `${path.sep}node_modules${path.sep}.pnpm${path.sep}`
  const markerIndex = hapBin.indexOf(marker)
  if (markerIndex < 0) {
    return
  }
  const virtualStoreDir = hapBin.slice(0, markerIndex + marker.length - 1)
  const outputNodeModules = path.resolve(outDir, 'node_modules')
  const outputVirtualStore = path.resolve(outputNodeModules, '.pnpm')
  await mkdir(outputNodeModules, { recursive: true })
  try {
    await symlink(virtualStoreDir, outputVirtualStore, process.platform === 'win32' ? 'junction' : 'dir')
  }
  catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') {
      throw error
    }
  }
}

export async function prepareHapToolkitProject(config: ResolvedQuickAppConfig) {
  const hapBin = await resolveHapBin(config.cwd)
  await ensurePnpmVirtualStoreLink(config.outDir, hapBin)
  return hapBin
}

async function collectRpkFiles(outDir: string) {
  const distDir = path.resolve(outDir, 'dist')
  try {
    const entries = await readdir(distDir)
    return entries
      .filter(fileName => fileName.endsWith('.rpk'))
      .map(fileName => path.resolve(distDir, fileName))
      .sort()
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export async function runHapToolkitBuild(config: ResolvedQuickAppConfig) {
  const hapBin = await prepareHapToolkitProject(config)
  const args = ['build']
  if (config.toolkit.devtool) {
    args.push('--devtool', config.toolkit.devtool)
  }
  if (config.toolkit.e2e) {
    args.push('--enable-e2e')
  }
  args.push(...config.toolkit.args)
  const result = await x(process.execPath, [hapBin, ...args], {
    nodeOptions: {
      cwd: config.outDir,
    },
  })
  const output = `${result.stdout}${result.stderr}`
  process.stdout.write(output)
  if (result.exitCode !== 0 || /^\s*\[ERROR\]|\sERROR:/m.test(output)) {
    throw new Error('hap-toolkit 报告了编译错误，请检查上方日志。')
  }
  const rpkFiles = await collectRpkFiles(config.outDir)
  if (rpkFiles.length === 0) {
    throw new Error('hap-toolkit 构建结束，但没有生成 RPK 文件。')
  }
  return rpkFiles
}

export async function runHapToolkitWatch(config: ResolvedQuickAppConfig) {
  const hapBin = await prepareHapToolkitProject(config)
  const args = ['watch']
  if (config.toolkit.devtool) {
    args.push('--devtool', config.toolkit.devtool)
  }
  if (config.toolkit.e2e) {
    args.push('--enable-e2e')
  }
  args.push(...config.toolkit.args)
  return {
    process: x(process.execPath, [hapBin, ...args], {
      nodeOptions: {
        cwd: config.outDir,
        stdio: 'inherit',
      },
    }),
  }
}
