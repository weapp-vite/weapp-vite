import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { runCommand } from './process.mjs'

const DEFAULT_PNPM_VERSION = process.env.CREATE_WEAPP_VITE_PNPM_VERSION?.trim() || '12'

export function createPnpmCommand(args, pnpmVersion = DEFAULT_PNPM_VERSION, profileConfig = {}) {
  const configArgs = Object.entries(profileConfig).map(([name, value]) => `--config.${name}=${value}`)
  return { command: 'corepack', args: [`pnpm@${pnpmVersion}`, ...configArgs, ...args] }
}

export function createPnpmInstallCommand(pnpmVersion = DEFAULT_PNPM_VERSION, profileConfig = {}) {
  return createPnpmCommand(['install'], pnpmVersion, profileConfig)
}

export function createScenario(name, profileConfig = {}) {
  if (!['pnpm', 'npm', 'yarn'].includes(name)) {
    throw new Error(`Unknown package manager scenario: ${name}`)
  }
  return {
    name,
    createCommand(projectName, templateName, packageSpec = 'latest') {
      const specifier = packageSpec === 'latest' && name === 'yarn' ? 'weapp-vite' : `weapp-vite@${packageSpec}`
      const args = ['create', specifier]
      if (name === 'npm') {
        args.push('--')
      }
      args.push(projectName, templateName, '--no-install-skills')
      return name === 'pnpm' ? createPnpmCommand(args, DEFAULT_PNPM_VERSION, profileConfig) : { command: name, args }
    },
    installCommand() {
      return name === 'pnpm' ? createPnpmInstallCommand(DEFAULT_PNPM_VERSION, profileConfig) : { command: name, args: ['install'] }
    },
    buildCommand() {
      return name === 'pnpm' ? createPnpmCommand(['build'], DEFAULT_PNPM_VERSION, profileConfig) : { command: name, args: ['run', 'build'] }
    },
    devCommand() {
      return name === 'pnpm' ? createPnpmCommand(['dev'], DEFAULT_PNPM_VERSION, profileConfig) : { command: name, args: ['run', 'dev'] }
    },
  }
}

export function createTarballInstallCommand(tarball, config = {}) {
  const profileArgs = Object.entries(config).map(([name, value]) => `--${name}=${value}`)
  return {
    command: 'npm',
    args: ['install', '--no-audit', '--no-fund', '--package-lock=false', ...profileArgs, tarball],
  }
}

export async function installTarballRunner(tarball, runnerRoot, env, timeoutMs) {
  await fs.mkdir(runnerRoot, { recursive: true })
  await fs.writeFile(path.join(runnerRoot, 'package.json'), JSON.stringify({ private: true }))
  await runCommand({
    ...createTarballInstallCommand(tarball, {
      'registry': env.npm_config_registry,
      'cache': env.npm_config_cache,
      'ignore-scripts': false,
    }),
    cwd: runnerRoot,
    env,
    timeoutMs,
    label: 'install local scaffold tarball',
  })
  const packageRoot = path.join(runnerRoot, 'node_modules/create-weapp-vite')
  const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'))
  if (manifest.name !== 'create-weapp-vite' || typeof manifest.version !== 'string') {
    throw new Error('Local tarball is not a create-weapp-vite package')
  }
  return packageRoot
}

export async function createTarballCommand(packageRoot, projectName, templateName) {
  const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'))
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.['create-weapp-vite']
  if (typeof bin !== 'string') {
    throw new TypeError('Local tarball has no create-weapp-vite binary')
  }
  return {
    command: process.execPath,
    args: [path.resolve(packageRoot, bin), projectName, templateName, '--no-install-skills'],
  }
}
