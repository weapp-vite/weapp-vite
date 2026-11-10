import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 验收需要跨平台启动真实包管理器。
import { execa } from 'execa'
import { parse, stringify } from 'yaml'
import { distribution, repositoryRoot } from './distribution.mjs'
import { verifyNativeBoundaries } from './native-boundaries.mjs'

const evidenceRoot = path.resolve(process.argv[2] ?? '.tmp/package-skills')
const pnpm = process.env.PNPM_SKILLS_BIN ?? 'pnpm'
await fs.mkdir(evidenceRoot, { recursive: true })
const output = await fs.mkdtemp(path.join(evidenceRoot, 'run-'))
let sequence = 0
const dependencyOverrides = {}

async function run(cwd, args, executable = pnpm) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:CLAUDECODE|CLAUDE_CODE|CURSOR_AGENT|GEMINI_CLI|ANTIGRAVITY_AGENT|COPILOT_AGENT|COPILOT_CLI|CODEX_THREAD_ID|CODEX_SANDBOX|AI_AGENT)$/.test(key)))
  const result = await execa(executable, args, { cwd, reject: false, timeout: 120_000, extendEnv: false, env: { ...env, CI: 'true' } })
  const label = `${String(++sequence).padStart(3, '0')}-${path.basename(cwd)}-${args[0]}`
  await fs.writeFile(path.join(output, `${label}.log`), `${executable} ${args.join(' ')}\nexit=${result.exitCode}\n${result.stdout}\n${result.stderr}\n`)
  assert.equal(result.exitCode, 0, `${label}: ${result.stderr || result.stdout}`)
  return result.stdout
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

async function project(name, dependencies = {}, dirs = ['.agents/skills'], packages = ['.']) {
  const cwd = path.join(output, name)
  await fs.mkdir(cwd, { recursive: true })
  await writeJson(path.join(cwd, 'package.json'), { name, private: true, dependencies })
  await fs.writeFile(path.join(cwd, 'pnpm-workspace.yaml'), stringify({
    packages,
    autoInstallPeers: false,
    ignoreScripts: true,
    minimumReleaseAge: 0,
    skills: { dirs },
    permissions: {},
    overrides: dependencyOverrides,
  }))
  return cwd
}

async function entries(cwd, directory = '.agents/skills') {
  const items = await fs.readdir(path.join(cwd, directory), { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
  return items.filter(entry => entry.isSymbolicLink()).map(entry => entry.name).sort()
}

async function verifyTrees(root, config) {
  assert.deepEqual((await fs.readdir(path.join(root, 'skills'))).sort(), [...config.skills].sort())
  for (const name of config.skills) {
    const source = path.join(repositoryRoot, 'skills', name)
    for await (const relative of fs.glob('**/*', { cwd: source })) {
      if (!(await fs.stat(path.join(source, relative))).isFile()) {
        continue
      }
      assert.deepEqual(await fs.readFile(path.join(root, 'skills', name, relative)), await fs.readFile(path.join(source, relative)), `${name}/${relative}`)
    }
  }
}

const versionProbe = await project('version-check')
const nativeVersion = (await run(versionProbe, ['--version'])).trim()
const [major, minor] = nativeVersion.split('.').map(Number)
assert(major === 12 && minor >= 11, `No verified native skills contract for pnpm ${nativeVersion}`)
// 12.18 的已发布变更引入原名链接、逐项批准与更深层发现；旧版本仍按原契约验收。
const modernSkills = minor >= 18
const skillLink = (owner, name) => modernSkills ? name : `pnpm-${owner.replace('/', '+')}-${name}`

// 尚未发布的 workspace 依赖也使用真实 tarball，不删除发布清单中的依赖来换取验收通过。
const workspace = parse(await fs.readFile(path.join(repositoryRoot, 'pnpm-workspace.yaml'), 'utf8'))
const members = {}
for await (const file of fs.glob(workspace.packages.filter(pattern => !pattern.startsWith('!')).map(pattern => `${pattern}/package.json`), {
  cwd: repositoryRoot,
  exclude: workspace.packages.filter(pattern => pattern.startsWith('!')).map(pattern => `${pattern.slice(1)}/**`),
})) {
  const manifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, file), 'utf8'))
  members[manifest.name] = { manifest, directory: path.dirname(file) }
}
const pending = Object.keys(distribution.packages)
const visited = new Set()
while (pending.length) {
  const name = pending.pop()
  if (visited.has(name) || !members[name]) {
    continue
  }
  visited.add(name)
  const { manifest, directory } = members[name]
  pending.push(...Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }))
  if (distribution.packages[name]) {
    continue
  }
  await run(path.join(repositoryRoot, directory), ['pack', '--pack-destination', output], 'pnpm')
  dependencyOverrides[name] = `file:${path.join(output, `${name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`)}`
}
const tarballs = {}
const observations = []
for (const [owner, config] of Object.entries(distribution.packages)) {
  const pkgRoot = path.join(repositoryRoot, config.directory)
  await run(pkgRoot, ['pack', '--pack-destination', output], 'pnpm')
  const manifest = JSON.parse(await fs.readFile(path.join(pkgRoot, 'package.json'), 'utf8'))
  const tarball = path.join(output, `${owner.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`)
  await fs.access(tarball)
  tarballs[owner] = tarball
  const extraction = path.join(output, `unpacked-${owner.replace(/[^a-z\d-]/g, '-')}`)
  await fs.mkdir(extraction, { recursive: true })
  // Windows GNU tar 会把盘符解释为远程主机，归档参数使用相对 POSIX 路径。
  await run(extraction, ['-xzf', path.relative(extraction, tarball).replaceAll(path.sep, '/')], 'tar')
  await verifyTrees(path.join(extraction, 'package'), config)
  const cwd = await project(`consumer-${owner.replace(/[^a-z\d-]/g, '-')}`, { [owner]: `file:${tarball}` })
  const approval = `${owner}@file:../${path.basename(tarball)}`
  await run(cwd, ['install'])
  assert.deepEqual(await entries(cwd), [], `${owner}: unapproved skills linked`)
  await run(cwd, ['approve', approval])
  const expected = config.skills.map(name => skillLink(owner, name)).sort()
  assert.deepEqual(await entries(cwd), expected, `${owner}: wrong package skills`)
  for (const name of expected) {
    assert.equal((await fs.lstat(path.join(cwd, '.agents/skills', name))).isSymbolicLink(), true)
    await fs.access(path.join(cwd, '.agents/skills', name, 'SKILL.md'))
  }
  if (modernSkills && config.skills.length > 1) {
    const file = path.join(cwd, 'pnpm-workspace.yaml')
    const policy = parse(await fs.readFile(file, 'utf8'))
    policy.permissions[approval].skills = [config.skills[0]]
    await fs.writeFile(file, stringify(policy))
    await run(cwd, ['install'])
    assert.deepEqual(await entries(cwd), [config.skills[0]], '12.18 selective approval must exclude unselected skills')
    await run(cwd, ['approve', approval])
    assert.deepEqual(await entries(cwd), expected)
  }
  const manual = path.join(cwd, '.agents/skills', 'my-manual-guidance')
  await fs.mkdir(manual)
  await fs.writeFile(path.join(manual, 'SKILL.md'), 'manual contents\n')
  await run(cwd, ['approve', `!${approval}`])
  assert.deepEqual(await entries(cwd), [], `${owner}: revoke did not clean`)
  assert.equal(await fs.readFile(path.join(manual, 'SKILL.md'), 'utf8'), 'manual contents\n')
  await run(cwd, ['approve', approval])
  await run(cwd, ['remove', owner])
  assert.deepEqual(await entries(cwd), [], `${owner}: remove did not clean`)
  assert.equal(await fs.readFile(path.join(manual, 'SKILL.md'), 'utf8'), 'manual contents\n')
  observations.push({ owner, tarball: path.basename(tarball), skills: config.skills, lifecycle: 'unapproved → approve → revoke → approve → remove', status: 'pass' })
}

const custom = await project('custom-directory', { wevu: `file:${tarballs.wevu}` }, ['guidance/skills'])
await run(custom, ['install'])
await run(custom, ['approve', `wevu@file:../${path.basename(tarballs.wevu)}`])
assert.deepEqual(await entries(custom), [])
assert.deepEqual(await entries(custom, 'guidance/skills'), [skillLink('wevu', 'wevu-best-practices')])
observations.push({ scenario: 'custom skills.dirs', status: 'pass' })

const wrapper = path.join(output, 'wrapper')
await fs.mkdir(wrapper, { recursive: true })
await writeJson(path.join(wrapper, 'package.json'), { name: 'skills-wrapper', version: '1.0.0', dependencies: { wevu: `file:${tarballs.wevu}` } })
await run(wrapper, ['pack', '--pack-destination', output], 'npm')
const transitive = await project('transitive-only', { 'skills-wrapper': `file:${path.join(output, 'skills-wrapper-1.0.0.tgz')}` })
await run(transitive, ['install'])
const transitiveApproval = `wevu@file:../${path.basename(tarballs.wevu)}`
await run(transitive, ['approve', transitiveApproval])
const transitivePolicy = parse(await fs.readFile(path.join(transitive, 'pnpm-workspace.yaml'), 'utf8'))
assert.equal(transitivePolicy.permissions[transitiveApproval].skills, true)
assert.deepEqual(await entries(transitive), [])
// 同一来源成为直接依赖后必须链接；移除直接声明后再次清理，排除未授权导致的假阴性。
await run(transitive, ['add', `wevu@file:${tarballs.wevu}`])
assert.deepEqual(await entries(transitive), [skillLink('wevu', 'wevu-best-practices')])
await run(transitive, ['remove', 'wevu'])
assert.deepEqual(await entries(transitive), [])
observations.push({ scenario: 'approved exact source: transitive excluded, direct positive control linked, removal excluded again', status: 'pass' })
observations.push(...await verifyNativeBoundaries({ output, run, project, entries, writeJson, modernSkills, skillLink }))

if (modernSkills) {
  const noDirectory = await project('no-agent-directory', { wevu: `file:${tarballs.wevu}` })
  const noDirectoryPolicy = parse(await fs.readFile(path.join(noDirectory, 'pnpm-workspace.yaml'), 'utf8'))
  delete noDirectoryPolicy.skills
  noDirectoryPolicy.permissions[`wevu@file:../${path.basename(tarballs.wevu)}`] = { skills: true }
  await fs.writeFile(path.join(noDirectory, 'pnpm-workspace.yaml'), stringify(noDirectoryPolicy))
  await run(noDirectory, ['install'])
  const targetDirectories = []
  for (const entry of await fs.readdir(noDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('.')) {
      const directory = path.join(noDirectory, entry.name, 'skills')
      const exists = await fs.stat(directory).then(stat => stat.isDirectory(), error => error.code === 'ENOENT' ? false : Promise.reject(error))
      if (exists) {
        targetDirectories.push(entry.name)
      }
    }
  }
  assert.deepEqual(targetDirectories, [], 'agent environment must not create any hidden skill directory')
  observations.push({ scenario: '12.18 approved without directory installs without links', status: 'pass' })
}

await fs.writeFile(path.join(output, 'tarballs.json'), `${JSON.stringify(tarballs, null, 2)}\n`)
await fs.writeFile(path.join(output, 'results.json'), `${JSON.stringify({ pnpm: nativeVersion, observations }, null, 2)}\n`)
console.log(JSON.stringify(observations, null, 2))
console.log(`Evidence: ${path.relative(repositoryRoot, output)}`)
