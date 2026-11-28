import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
/* eslint-disable e18e/ban-dependencies -- workspace package discovery follows the same fast-glob contract as repository release checks. */
import fg from 'fast-glob'
import { parse } from 'yaml'

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const execFileAsync = promisify(execFile)

function ignoredPatterns(patterns) {
  return patterns.filter(pattern => pattern.startsWith('!')).flatMap((pattern) => {
    const normalized = pattern.slice(1).replace(/\/$/u, '')
    return normalized.endsWith('/**') ? [normalized] : [normalized, `${normalized}/**`]
  })
}

export async function discoverWorkspacePackages(cwd = repositoryRoot) {
  const workspace = parse(await fs.readFile(path.join(cwd, 'pnpm-workspace.yaml'), 'utf8'))
  const patterns = workspace?.packages
  if (!Array.isArray(patterns) || patterns.some(pattern => typeof pattern !== 'string')) {
    throw new Error('pnpm-workspace.yaml must declare package patterns')
  }
  const files = await fg(patterns
    .filter(pattern => !pattern.startsWith('!'))
    .map(pattern => `${pattern.replace(/\/$/u, '')}/package.json`), {
    cwd,
    ignore: ['**/node_modules/**', ...ignoredPatterns(patterns)],
    onlyFiles: true,
    unique: true,
  })
  return Promise.all(files.sort().map(async (file) => {
    const directory = path.posix.dirname(file.replaceAll('\\', '/'))
    const manifest = JSON.parse(await fs.readFile(path.join(cwd, file), 'utf8'))
    return { directory, manifest }
  }))
}

export async function discoverPackageSkills(cwd = repositoryRoot) {
  const packages = await discoverWorkspacePackages(cwd)
  const discovered = await Promise.all(packages.map(async ({ directory, manifest }) => {
    const skillsRoot = path.join(cwd, directory, 'skills')
    const entries = await fs.readdir(skillsRoot, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
    const skills = []
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      const skillFile = path.join(skillsRoot, entry.name, 'SKILL.md')
      if (await fs.stat(skillFile).then(stat => stat.isFile(), error => error.code === 'ENOENT' ? false : Promise.reject(error))) {
        skills.push({
          name: entry.name,
          file: path.posix.join(directory, 'skills', entry.name, 'SKILL.md'),
        })
      }
    }
    return { name: manifest.name, directory, manifest, skills }
  }))
  const hasGit = await fs.access(path.join(cwd, '.git')).then(() => true, error => error.code === 'ENOENT' ? false : Promise.reject(error))
  let tracked
  if (hasGit) {
    const files = discovered.flatMap(pkg => pkg.skills.map(skill => skill.file))
    const { stdout } = files.length > 0
      ? await execFileAsync('git', ['ls-files', '-z', '--', ...files], { cwd })
      : { stdout: '' }
    tracked = new Set(stdout.split('\0').filter(Boolean).map(file => file.replaceAll('\\', '/')))
  }
  return discovered.map(pkg => ({
    ...pkg,
    skills: pkg.skills.filter(skill => !tracked || tracked.has(skill.file)).map(skill => skill.name).sort(),
  })).filter(pkg => pkg.skills.length > 0).sort((a, b) => a.directory.localeCompare(b.directory))
}

export async function discoverPublicSkillSources(cwd = repositoryRoot) {
  const root = path.join(cwd, 'skills')
  const entries = await fs.readdir(root, { withFileTypes: true })
  const repositorySkills = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const skillFile = path.join(root, entry.name, 'SKILL.md')
    if (await fs.stat(skillFile).then(stat => stat.isFile(), error => error.code === 'ENOENT' ? false : Promise.reject(error))) {
      repositorySkills.push({ name: entry.name, directory: `skills/${entry.name}`, owner: null })
    }
  }
  const packageSkills = (await discoverPackageSkills(cwd)).flatMap(pkg => pkg.skills.map(name => ({
    name,
    directory: `${pkg.directory}/skills/${name}`,
    owner: pkg.name,
  })))
  return [...repositorySkills, ...packageSkills].sort((a, b) => a.name.localeCompare(b.name))
}
