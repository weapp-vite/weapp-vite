/* eslint-disable antfu/no-import-dist */
import assert from 'node:assert/strict'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import {
  configSchema,
  projectFingerprint,
} from '../../packages/agent-core/dist/index.mjs'
import { connectMcp } from '../../packages/agent-mini-program/dist/index.mjs'

const root = process.env.WEAPP_AGENT_DEVTOOLS_FIXTURE
if (!root) {
  throw new Error(
    'Set WEAPP_AGENT_DEVTOOLS_FIXTURE to an isolated built fixture containing pages/agent-proof/index and a real AppID',
  )
}
const artifacts = path.resolve(import.meta.dirname, '../../artifacts/weapp-agent')
await mkdir(artifacts, { recursive: true })
const config = configSchema.parse({
  model: { provider: 'openai', name: 'not-used' },
})
const context = {
  root,
  trusted: true,
  signal: AbortSignal.timeout(240_000),
  approve: async () => false,
}
let connection
const evidence = []
try {
  const project = JSON.parse(
    await readFile(path.join(root, 'project.config.json'), 'utf8'),
  )
  assert(
    project.appid && project.appid !== 'touristappid',
    'A real local test AppID is required',
  )
  connection = await connectMcp(
    {
      name: 'weapp',
      transport: 'stdio',
      command: process.execPath,
      args: [
        path.join(root, 'node_modules/weapp-vite/bin/weapp-vite.js'),
        'mcp',
        '--workspace-root',
        root,
      ],
    },
    context,
    {
      config,
      fingerprint: await projectFingerprint(root, config),
      builtin: true,
    },
  )
  async function invoke(name, input) {
    const tool = connection.tools.find(
      tool => tool.name === `weapp__${name}`,
    )
    assert(tool, `Missing runtime capability: ${name}`)
    const result = await tool.execute(input, context)
    const data = result.data ?? JSON.parse(result.text)
    evidence.push({ name, data })
    return data
  }
  const scope = {
    projectPath: root,
    timeout: 60_000,
    preserveProjectRoot: true,
  }
  await invoke('weapp_devtools_connect', scope)
  await invoke('weapp_devtools_route', {
    ...scope,
    path: '/pages/agent-proof/index',
    transition: 'reLaunch',
    waitMs: 1500,
  })
  const before = await invoke('weapp_runtime_find_node', {
    ...scope,
    selector: '#count',
  })
  assert.equal(before.result.text, '0', 'Counter starts at zero')
  await invoke('weapp_runtime_tap_node', { ...scope, selector: '#increment' })
  let after
  for (let attempt = 0; attempt < 30; attempt++) {
    after = await invoke('weapp_runtime_find_node', { ...scope, selector: '#count' })
    if (after.result.text === '1') {
      break
    }
    await setTimeout(100)
  }
  assert.equal(after.result.text, '1', 'Counter increments to one after a real tap')
  await invoke('weapp_devtools_capture', {
    ...scope,
    outputPath: 'agent-proof.png',
  })
  await copyFile(
    path.join(root, 'agent-proof.png'),
    path.join(artifacts, 'devtools.png'),
  )
  const logs = await invoke('weapp_devtools_console', {})
  assert(
    JSON.stringify(logs).includes('weapp-agent:increment'),
    'Real console log must be captured',
  )
  await writeFile(
    path.join(artifacts, 'devtools.json'),
    JSON.stringify(
      { status: 'passed', provider: 'real-wechat-devtools', evidence },
      null,
      2,
    ),
  )
  console.log(
    'PASS: real WeChat page navigation, counter interaction, screenshot, and console logs through project-local MCP',
  )
}
catch (error) {
  await writeFile(
    path.join(artifacts, 'devtools.json'),
    JSON.stringify(
      { status: 'failed', error: error.message, evidence },
      null,
      2,
    ),
  )
  throw error
}
finally {
  await connection?.close()
}
