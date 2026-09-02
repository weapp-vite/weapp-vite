import fs from 'node:fs/promises'
import path from 'node:path'
import {
  REPO_ROOT,
  WORKSPACE_PACKAGE_DIRS,
} from './config'

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const

export function normalizeReportText(value: string, tempRoot: string) {
  const normalized = value.replaceAll('\\', '/')
  return normalized
    .replaceAll(REPO_ROOT.replaceAll('\\', '/'), '<repo>')
    .replaceAll(tempRoot.replaceAll('\\', '/'), '<tmp>')
}

export async function linkWorkspacePackages(projectDir: string) {
  const packageJsonPath = path.join(projectDir, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as PackageJson
  const linkedPackages: string[] = []

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJson[field]
    if (!dependencies) {
      continue
    }
    for (const [packageName, relativeDir] of Object.entries(WORKSPACE_PACKAGE_DIRS)) {
      if (!(packageName in dependencies)) {
        continue
      }
      dependencies[packageName] = `link:${path.join(REPO_ROOT, relativeDir)}`
      linkedPackages.push(packageName)
    }
  }

  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
  return [...new Set(linkedPackages)].sort()
}
