import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import caseCatalog from '../../maintainers/skillValidation/cases.json' with { type: 'json' }
import distribution from '../../skills/distribution.json' with { type: 'json' }
import { safeProjectFilePath, validateCaseCatalog } from './contracts.mjs'

/** 指纹覆盖正文、引用与元数据，避免引用变化后沿用旧验证。 */
export async function hashSkillTree(directory) {
  const hash = createHash('sha256')
  async function visit(current, relative = '') {
    const entries = (await fs.readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))
    for (const entry of entries) {
      assert(!entry.isSymbolicLink(), `Skill source must not contain symbolic links: ${relative}/${entry.name}`)
      const name = relative ? `${relative}/${entry.name}` : entry.name
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(file, name)
      }
      else if (entry.isFile()) {
        const content = await fs.readFile(file)
        hash.update(name).update('\0').update(String(content.length)).update('\0').update(content)
      }
    }
  }
  await visit(directory)
  return hash.digest('hex')
}

/** 只创建本次拥有的新项目；依赖来自已核验的 tarball 安装，不执行安装或模型。 */
export async function createSkillCaseFixture({ caseId, outputParent, skillRoot, installedModulesRoot, catalog = caseCatalog }) {
  const issues = validateCaseCatalog(catalog, distribution.packages)
  assert.equal(issues.length, 0, `Invalid skill case contracts: ${JSON.stringify(issues)}`)
  const taskCase = catalog.cases.find(item => item.id === caseId)
  assert(taskCase, `Unknown skill case: ${caseId}`)
  assert(typeof outputParent === 'string' && outputParent, 'An owned fixture parent is required')
  assert(typeof installedModulesRoot === 'string' && installedModulesRoot, 'An existing verified consumer installation is required')
  const packages = {}
  const locations = {}
  const required = new Set(taskCase.dependencies)
  for (const name of required) {
    const location = await fs.realpath(path.join(installedModulesRoot, name))
    const manifest = JSON.parse(await fs.readFile(path.join(location, 'package.json'), 'utf8'))
    assert.equal(manifest.name, name, `Unexpected installed dependency identity: ${name}`)
    assert(typeof manifest.version === 'string' && manifest.version, `Missing installed version: ${name}`)
    packages[name] = manifest
    locations[name] = location
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
      if (!manifest.peerDependenciesMeta?.[peer]?.optional) {
        required.add(peer)
      }
    }
  }
  const sourceSkill = path.join(skillRoot, taskCase.skill)
  await fs.access(path.join(sourceSkill, 'SKILL.md'))
  const skillDigest = await hashSkillTree(sourceSkill)
  const scripts = {}
  if (taskCase.mode === 'edit-build') {
    const bin = packages['weapp-vite']?.bin?.wv
    assert(typeof bin === 'string' && bin && !/["\r\n]/.test(bin), 'The build fixture requires the declared weapp-vite CLI')
    const entry = path.posix.join('node_modules', 'weapp-vite', bin.replaceAll('\\', '/'))
    scripts.build = `node ${JSON.stringify(entry)} build`
  }
  await fs.mkdir(outputParent, { recursive: true })
  const root = await fs.mkdtemp(path.join(outputParent, 'project-'))
  try {
    await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({
      name: 'inventory-app',
      private: true,
      type: 'module',
      ...(Object.keys(scripts).length ? { scripts } : {}),
      dependencies: Object.fromEntries(Object.entries(packages).map(([name, manifest]) => [name, manifest.version])),
    }, null, 2)}\n`)
    await fs.writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\nverifyDepsBeforeRun: false\nskills:\n  dirs: [.agents/skills]\n')
    for (const [relative, content] of Object.entries(taskCase.files)) {
      assert(safeProjectFilePath(relative), `Unsafe fixture file: ${relative}`)
      const file = path.join(root, ...relative.split('/'))
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, content)
    }
    for (const [name, location] of Object.entries(locations)) {
      const target = path.join(root, 'node_modules', name)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.symlink(location, target, process.platform === 'win32' ? 'junction' : 'dir')
    }
    await fs.mkdir(path.join(root, '.agents/skills'), { recursive: true })
    await fs.cp(sourceSkill, path.join(root, '.agents/skills', taskCase.skill), { recursive: true })
    return {
      root,
      caseId,
      skill: taskCase.skill,
      skillDigest,
      packages: Object.fromEntries(Object.entries(packages).map(([name, manifest]) => [name, manifest.version])),
      fixtureMode: 'selected links to a verified public-tarball installation; skill copied explicitly',
      cleanup: () => fs.rm(root, { recursive: true, force: true }),
    }
  }
  catch (error) {
    await fs.rm(root, { recursive: true, force: true })
    throw error
  }
}
