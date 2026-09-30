import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- Preserve cross-platform command resolution, cancellation and process cleanup semantics.
import { execa } from 'execa'
import YAML from 'yaml'
import { packWorkspace } from './pack-workspace.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const temporary = await mkdtemp(path.join(tmpdir(), 'weapp-pack-'))
const artifacts = path.join(root, 'artifacts')
await mkdir(artifacts, { recursive: true })
try {
  const overrides = await packWorkspace(root, artifacts)
  const cliPackage = JSON.parse(await readFile(path.join(root, 'packages/agent-cli/package.json'), 'utf8'))
  const archive = `${cliPackage.name.replace(/^@/, '').replace('/', '-')}-${cliPackage.version}.tgz`
  assert((await readdir(artifacts)).includes(archive))
  assert(archive, 'Package archive exists')
  await writeFile(
    path.join(temporary, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  )
  await writeFile(path.join(temporary, 'pnpm-workspace.yaml'), YAML.stringify({ packages: ['.'], overrides }))
  await execa(
    'pnpm',
    ['add', '--ignore-scripts', ...(process.env.WEAPP_AGENT_PACK_OFFLINE ? ['--offline'] : []), path.join(artifacts, archive), overrides['weapp-vite']],
    { cwd: temporary, timeout: 180_000 },
  )
  const cli = path.join(
    temporary,
    'node_modules/@weapp-agent/cli/dist/index.mjs',
  )
  const { stdout: help } = await execa(process.execPath, [cli, '--help'])
  for (const command of ['run', 'resume', 'doctor', 'verify', 'accept', 'report', 'mcp', 'skill']) {
    assert(help.includes(command))
  }
  const project = path.join(temporary, 'project')
  await mkdir(project)
  await writeFile(
    path.join(project, 'package.json'),
    JSON.stringify({ scripts: { build: 'node -e "console.log(42)"' } }),
  )
  const env = {
    ...process.env,
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    WEAPP_AGENT_STATE_DIR: path.join(temporary, 'state'),
  }
  await execa(
    process.execPath,
    [cli, '-C', project, 'init', '--model', 'mock', '--json'],
    { env },
  )
  const { stdout: result } = await execa(
    process.execPath,
    [cli, '-C', project, '--trust', 'verify', '--json'],
    { env },
  )
  const report = JSON.parse(result)
  assert.equal(report.passed, true)
  assert.equal(
    report.checks.find(check => check.kind === 'devtools').status,
    'unverified',
  )
  const modelFree = path.join(temporary, 'model-free')
  await mkdir(modelFree)
  await writeFile(path.join(modelFree, 'package.json'), JSON.stringify({
    dependencies: { 'weapp-vite': '7.4.0' },
    scripts: { build: 'node -e "console.log(42)"' },
  }))
  await execa(process.execPath, [cli, '-C', modelFree, 'init', '--json'], { env })
  const doctor = await execa(process.execPath, [cli, '-C', modelFree, 'doctor', '--json'], { env })
  assert.equal(JSON.parse(doctor.stdout).modelRequired, false)
  const missing = await execa(process.execPath, [cli, '-C', modelFree, '--trust', 'accept', '--json'], { env, reject: false })
  assert.equal(missing.exitCode, 1)
  assert.equal(JSON.parse(missing.stdout).status, 'unverified')
  const configPath = path.join(modelFree, 'weapp-agent.config.json')
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  config.acceptance.requiredChecks = ['build']
  await writeFile(configPath, JSON.stringify(config))
  await execa(process.execPath, [cli, '-C', modelFree, '--trust', 'accept', '--json'], { env })

  // A genuine stdio MCP handshake against the installed tarball, not source imports.
  const require = createRequire(await realpath(cli))
  const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client')))
  const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client/stdio')))
  const client = new Client({ name: 'installed-package-smoke', version: '1' })
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, '-C', modelFree, 'mcp'], env, stderr: 'pipe' }))
    assert.equal((await client.listTools()).tools.length, 5)
    const started = await client.callTool({ name: 'weapp_acceptance_start', arguments: {} })
    const jobId = started.structuredContent.jobId
    const deadline = Date.now() + 15_000
    let current
    do {
      await new Promise(resolve => setTimeout(resolve, 50))
      current = await client.callTool({ name: 'weapp_acceptance_status', arguments: { jobId } })
    } while (current.structuredContent.status === 'running' && Date.now() < deadline)
    assert.equal(current.structuredContent.passed, true)
    const saved = await execa(process.execPath, [cli, '-C', modelFree, 'report', jobId, '--json'], { env })
    assert.equal(JSON.parse(saved.stdout).version, 2)
  }
  finally {
    await client.close()
  }
  const wv = path.join(temporary, 'node_modules/weapp-vite/bin/weapp-vite.js')
  await writeFile(path.join(modelFree, 'vite.config.ts'), 'throw new Error("inspection must not evaluate Vite config")')
  const inspected = await execa(process.execPath, [wv, 'accept', modelFree, '--inspect', '--json'], { env })
  assert.equal(JSON.parse(inspected.stdout).modelRequired, false)
  await rm(path.join(modelFree, 'vite.config.ts'))
  const accepted = await execa(process.execPath, [wv, 'accept', modelFree, '--trust', '--json'], { env })
  assert.equal(JSON.parse(accepted.stdout).passed, true)
  const skillDirectory = path.join(temporary, 'weapp-acceptance')
  await execa(process.execPath, [cli, 'skill', skillDirectory, '--json'], { env })
  assert((await readFile(path.join(skillDirectory, 'SKILL.md'), 'utf8')).includes('weapp_acceptance_start'))
  assert((await readFile(path.join(skillDirectory, 'references/scenarios.md'), 'utf8')).includes('requiredChecks'))
  const collision = await execa(process.execPath, [cli, 'skill', skillDirectory, '--json'], { env, reject: false })
  assert.notEqual(collision.exitCode, 0)
  const manifest = JSON.parse(
    await readFile(
      path.join(temporary, 'node_modules/@weapp-agent/cli/package.json'),
      'utf8',
    ),
  )
  assert(
    !Object.keys(manifest.dependencies).some(name =>
      name.startsWith('@weapp-agent/'),
    ),
    'Private workspace packages are bundled',
  )
  console.log(
    'PASS: installed tarball, legacy verify, model-free acceptance, stdio MCP lifecycle, persisted report, and opt-in Skill installation',
  )
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
