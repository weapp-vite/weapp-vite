import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createTutorialRuns,
  MINIAPP_PLATFORM_OUTPUTS,
  MULTI_PLATFORM_TEMPLATES,
  REPO_ROOT,
  TUTORIAL_DOC_CONTRACTS,
  TUTORIAL_SCENARIO_IDS,
} from './config'
import { createProjectCommand, installCommand } from './packageManager'
import { parseTutorialCliOptions } from './run'
import { normalizeReportText } from './workspace'

async function readRepoFile(relativePath: string) {
  return await fs.readFile(path.join(REPO_ROOT, relativePath), 'utf8')
}

interface PackageManifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

async function readRepoPackageManifest(relativePath: string) {
  return JSON.parse(await readRepoFile(relativePath)) as PackageManifest
}

describe('tutorial e2e contracts', () => {
  it('keeps tutorial docs and scenario registry aligned', async () => {
    for (const contract of TUTORIAL_DOC_CONTRACTS) {
      const content = await readRepoFile(contract.file)
      expect(content).toContain(`tutorial-e2e:${contract.marker}`)
      for (const required of contract.required) {
        expect(content, `${contract.file} missing ${required}`).toContain(required)
      }
    }
  })

  it('covers all documented multi-platform targets and templates', async () => {
    const content = await readRepoFile('website/guide/multi-platform.md')
    for (const template of MULTI_PLATFORM_TEMPLATES) {
      expect(content).toContain(`my-app ${template}`)
    }
    for (const platform of Object.keys(MINIAPP_PLATFORM_OUTPUTS)) {
      expect(content).toContain(`pnpm build:${platform}`)
    }
  })

  it('keeps multi-platform templates free of runtime-owned direct dependencies', async () => {
    for (const template of MULTI_PLATFORM_TEMPLATES) {
      const manifest = await readRepoPackageManifest(
        `templates/weapp-vite-${template}-template/package.json`,
      )
      const directDependencies = {
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.optionalDependencies,
        ...manifest.peerDependencies,
      }

      expect(directDependencies).not.toHaveProperty('lit')
      expect(directDependencies).not.toHaveProperty('vite')
    }
  })

  it('creates the expected source-specific matrix', () => {
    expect(createTutorialRuns('npm', TUTORIAL_SCENARIO_IDS))
      .toHaveLength(4 + 1 + MULTI_PLATFORM_TEMPLATES.length)
    expect(createTutorialRuns('workspace', TUTORIAL_SCENARIO_IDS))
      .toHaveLength(1 + 1 + MULTI_PLATFORM_TEMPLATES.length)
  })

  it('keeps command arguments structured for cross-platform launchers', () => {
    expect(createProjectCommand('npm', 'npm', 'my app', 'default')).toEqual({
      args: ['create', 'weapp-vite@latest', 'my app', 'default', '--no-install-skills'],
      command: 'npm',
    })
    expect(installCommand('pnpm')).toEqual({
      args: ['pnpm@11', 'install', '--config.dangerouslyAllowAllBuilds=true'],
      command: 'corepack',
    })
  })

  it('parses scenario options and normalizes Windows paths and CRLF', () => {
    expect(parseTutorialCliOptions([
      '--source',
      'workspace',
      '--scenario',
      'handbook-wevu-counter',
      '--runtime-provider',
      'headless',
    ])).toMatchObject({
      runtimeProvider: 'headless',
      scenarios: ['handbook-wevu-counter'],
      source: 'workspace',
    })
    const windowsRepo = REPO_ROOT.replaceAll('/', '\\')
    expect(normalizeReportText(`C:\\tmp\\project ${windowsRepo}\r\n`, 'C:\\tmp\\project'))
      .toBe('<tmp> <repo>\r\n')
  })
})
