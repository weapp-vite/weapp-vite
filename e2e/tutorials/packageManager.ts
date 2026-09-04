import type { TutorialCommand, TutorialPackageManager, TutorialSource } from './config'
import path from 'node:path'
import process from 'node:process'
import {
  REPO_ROOT,

} from './config'

const PNPM_VERSION = '11'

function pnpm(args: string[]): TutorialCommand {
  return {
    args: [`pnpm@${PNPM_VERSION}`, ...args],
    command: 'corepack',
  }
}

export function createProjectCommand(
  source: TutorialSource,
  packageManager: TutorialPackageManager,
  projectName: string,
  template: string,
): TutorialCommand {
  if (source === 'workspace') {
    return {
      args: [
        path.join(REPO_ROOT, 'packages/create-weapp-vite/bin/create-weapp-vite.js'),
        projectName,
        template,
        '--no-install-skills',
      ],
      command: process.execPath,
    }
  }

  switch (packageManager) {
    case 'pnpm':
      return pnpm(['create', 'weapp-vite@latest', projectName, template, '--no-install-skills'])
    case 'npm':
      return {
        args: ['create', 'weapp-vite@latest', projectName, template, '--no-install-skills'],
        command: 'npm',
      }
    case 'yarn':
      return {
        args: ['create', 'weapp-vite', projectName, template, '--no-install-skills'],
        command: 'yarn',
      }
    case 'bun':
      return {
        args: ['create', 'weapp-vite@latest', projectName, template, '--no-install-skills'],
        command: 'bun',
      }
  }
}

export function installCommand(packageManager: TutorialPackageManager): TutorialCommand {
  switch (packageManager) {
    case 'pnpm':
      return pnpm(['install', '--config.dangerouslyAllowAllBuilds=true'])
    case 'npm':
      return { args: ['install'], command: 'npm' }
    case 'yarn':
      return { args: ['install'], command: 'yarn' }
    case 'bun':
      return { args: ['install'], command: 'bun' }
  }
}

export function packageScriptCommand(
  packageManager: TutorialPackageManager,
  script: string,
): TutorialCommand {
  switch (packageManager) {
    case 'pnpm':
      return pnpm([script])
    case 'npm':
      return { args: ['run', script], command: 'npm' }
    case 'yarn':
      return { args: [script], command: 'yarn' }
    case 'bun':
      return { args: ['run', script], command: 'bun' }
  }
}
