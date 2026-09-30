import type { ProjectInfo, VerificationCommand } from '@weapp-agent/core/project'
import { access, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { bounded, safePath } from '@weapp-agent/core/project'

async function json(file: string): Promise<Record<string, any>> {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  }
  catch {
    return {}
  }
}
export async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  }
  catch {
    return false
  }
}
export async function findProjectRoot(cwd: string): Promise<string> {
  const start = await realpath(cwd)
  let dir = start
  for (;;) {
    const pkg = await json(path.join(dir, 'package.json'))
    if (
      (await exists(path.join(dir, 'weapp-agent.config.json')))
      || (await exists(path.join(dir, 'weapp-acceptance.config.json')))
      || pkg.dependencies?.['weapp-vite']
      || pkg.devDependencies?.['weapp-vite']
      || (await exists(path.join(dir, 'project.config.json')))
    ) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      return start
    }
    dir = parent
  }
}
export async function detectProject(root: string): Promise<ProjectInfo> {
  root = await realpath(root)
  const pkg = await json(path.join(root, 'package.json'))
  const config = await json(path.join(root, 'project.config.json'))
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies }
  let vite = ''
  for (const file of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
    if (await exists(path.join(root, file))) {
      vite = await readFile(path.join(root, file), 'utf8')
    }
  }
  const sourceRoot
    = vite.match(/\bsrcRoot\s*:\s*['"]([^'"]+)['"]/)?.[1]
      ?? ((await exists(path.join(root, 'src'))) ? 'src' : '.')
  const outputRoot
    = vite.match(/\boutDir\s*:\s*['"]([^'"]+)['"]/)?.[1]
      ?? config.miniprogramRoot
      ?? (dependencies['weapp-vite'] ? 'dist' : '.')
  await safePath(root, sourceRoot)
  await safePath(root, outputRoot)
  const app = await json(path.join(root, sourceRoot, 'app.json'))
  const sources: string[] = []
  const scan = async (directory: string, depth = 0): Promise<void> => {
    if (depth > 8 || sources.length > 2000) {
      return
    }
    const entries = await readdir(await safePath(root, directory), {
      withFileTypes: true,
    }).catch(() => [])
    for (const entry of entries) {
      if (
        entry.isSymbolicLink()
        || entry.name.startsWith('.')
        || ['node_modules', 'dist'].includes(entry.name)
      ) {
        continue
      }
      const relative = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await scan(relative, depth + 1)
      }
      else
        if (/\.(?:vue|wxml)$/.test(entry.name)) {
          sources.push(
            path.relative(sourceRoot, relative).split(path.sep).join('/'),
          )
        }
    }
  }
  await scan(sourceRoot)
  const hasVue = sources.some(file => file.endsWith('.vue'))
  const hasNative = sources.some(file => file.endsWith('.wxml'))
  const warnings: string[] = []
  if (
    vite
    && !/\bsrcRoot\s*:\s*['"]/.test(vite)
    && !(await exists(path.join(root, sourceRoot, 'app.json')))
  ) {
    warnings.push(
      'Dynamic Vite configuration: source/output paths are inferred. Check project_info before editing.',
    )
  }
  return {
    root,
    kind:
      hasVue && Boolean(dependencies.wevu)
        ? 'wevu'
        : hasNative || dependencies['weapp-vite'] || config.appid || app.pages
          ? 'native'
          : 'unknown',
    packageManager: String(pkg.packageManager ?? '').startsWith('yarn')
      ? 'yarn'
      : String(pkg.packageManager ?? '').startsWith('bun')
        ? 'bun'
        : (await exists(path.join(root, 'pnpm-lock.yaml')))
          || (await exists(path.join(root, 'pnpm-workspace.yaml')))
          || String(pkg.packageManager ?? '').startsWith('pnpm')
            ? 'pnpm'
            : 'npm',
    sourceRoot,
    outputRoot,
    pages: Array.isArray(app.pages)
      ? app.pages
      : sources
          .filter(file => file.startsWith('pages/'))
          .map(file => file.replace(/\.(vue|wxml)$/, '')),
    subPackages: (app.subPackages ?? app.subpackages ?? []).map(
      (p: { root: string }) => p.root,
    ),
    scripts: pkg.scripts ?? {},
    weappViteVersion: dependencies['weapp-vite'],
    warnings,
  }
}
export function defaultVerification(
  project: ProjectInfo,
): VerificationCommand[] {
  return (['typecheck', 'build', 'test'] as const)
    .filter(kind => project.scripts[kind])
    .map(kind => ({
      kind,
      command: project.packageManager,
      args: ['run', kind],
      timeoutMs: 120_000,
    }))
}
export async function projectInstructions(
  project: ProjectInfo,
): Promise<string> {
  const snippets: string[] = []
  const add = async (file: string) => {
    try {
      const target = await safePath(project.root, file)
      snippets.push(
        `Instructions scoped to ${path.dirname(file)} (${file}):\n${bounded(await readFile(target, 'utf8'), 12000)}`,
      )
    }
    catch {
      /* Optional instruction file. */
    }
  }
  await add('AGENTS.md')
  await add('AGENTS.local.md')
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 6 || snippets.join('').length > 32000) {
      return
    }
    const entries = await readdir(await safePath(project.root, directory), {
      withFileTypes: true,
    }).catch(() => [])
    if (directory !== '.') {
      if (entries.some(e => e.name === 'AGENTS.md')) {
        await add(path.join(directory, 'AGENTS.md'))
      }
      if (entries.some(e => e.name === 'AGENTS.local.md')) {
        await add(path.join(directory, 'AGENTS.local.md'))
      }
    }
    for (const e of entries) {
      if (
        e.isDirectory()
        && !e.isSymbolicLink()
        && !e.name.startsWith('.')
        && !['node_modules', 'dist', 'coverage'].includes(e.name)
      ) {
        await visit(path.join(directory, e.name), depth + 1)
      }
    }
  }
  await visit('.', 0)
  const docs = path.join(project.root, 'node_modules/weapp-vite/dist/docs')
  // Installed package docs may be a pnpm symlink. Only this known package location is read.
  const names = await readdir(docs).catch(() => [])
  for (const name of names
    .filter(n =>
      /^(?:README|ai|cli|getting-started|configuration).*\.md$/i.test(n),
    )
    .slice(0, 4)) {
    snippets.push(
      `Installed weapp-vite documentation (${name}):\n${bounded(await readFile(path.join(docs, name), 'utf8'), 6000)}`,
    )
  }
  return `Project facts:\n${JSON.stringify(project)}\n${snippets.join('\n\n')}`
}
