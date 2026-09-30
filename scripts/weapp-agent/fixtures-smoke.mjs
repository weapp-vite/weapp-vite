/* eslint-disable antfu/no-import-dist */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  configSchema,
  fileTools,
  hash,
  projectFingerprint,
  runAgent,
} from '../../packages/agent-core/dist/index.mjs'
import {
  detectProject,
  verificationTool,
} from '../../packages/agent-mini-program/dist/index.mjs'

const results = []
for (const [kind, root] of [
  ['native', process.env.WEAPP_AGENT_NATIVE_FIXTURE],
  ['wevu', process.env.WEAPP_AGENT_WEVU_FIXTURE],
]) {
  if (!root) {
    throw new Error(
      `Set WEAPP_AGENT_${kind.toUpperCase()}_FIXTURE to an isolated, installed create-weapp-vite project`,
    )
  }
  const route = 'pages/agent-proof/index'
  const filename = `src/${route}.${kind === 'wevu' ? 'vue' : 'ts'}`
  const valid
    = kind === 'wevu'
      ? `<script setup lang="ts">\nimport { ref } from 'wevu'\nconst count = ref(0)\nfunction increment() { count.value++; console.log('weapp-agent:increment', count.value) }\n</script>\n<template><view><text id="count">{{ count }}</text><button id="increment" @tap="increment">Increment</button></view></template>\n`
      : `Page({ data: { count: 0 }, increment() { this.setData({ count: this.data.count + 1 }); console.log('weapp-agent:increment', this.data.count) } })\n`
  const broken = valid.replace(
    kind === 'wevu' ? 'const count = ref(0)' : 'count: 0',
    kind === 'wevu' ? 'const count = ???' : 'count: ???',
  )
  const create = [{ path: filename, content: broken }]
  if (kind === 'native') {
    create.push(
      {
        path: `src/${route}.wxml`,
        content:
          '<view><text id="count">{{count}}</text><button id="increment" bindtap="increment">Increment</button></view>',
      },
      { path: `src/${route}.json`, content: '{}' },
    )
  }
  let register
  if (kind === 'native') {
    const appSource = await readFile(path.join(root, 'src/app.json'), 'utf8')
    const appConfig = JSON.parse(appSource)
    appConfig.pages = [...new Set([...(appConfig.pages ?? []), route])]
    register = {
      path: 'src/app.json',
      expectedHash: hash(appSource),
      oldText: appSource,
      newText: JSON.stringify(appConfig, null, 2),
    }
  }
  let step = 0
  const model = {
    id: 'deterministic-fixture',
    async* stream() {
      const tool = (id, name, input) => ({
        type: 'call',
        call: { id, name, input },
      })
      if (step === 0) {
        if (register) {
          yield tool('register', 'edit_file', register)
        }
        for (const [i, input] of create.entries()) {
          yield tool(`create-${i}`, 'create_file', input)
        }
      }
      else if (step === 1 || step === 3) {
        yield tool(`verify-${step}`, 'verify_project', {})
      }
      else if (step === 2) {
        yield tool('repair', 'edit_file', {
          path: filename,
          expectedHash: hash(broken),
          oldText: '???',
          newText: kind === 'wevu' ? 'ref(0)' : '0',
        })
      }
      else {
        yield {
          type: 'text',
          text: 'Repaired the real build error and verified the page.',
        }
      }
      step++
    },
  }
  const config = configSchema.parse({
    model: { provider: 'openai', name: 'test' },
    verification: [{ kind: 'build', command: 'pnpm', args: ['run', 'build'] }],
  })
  const checks = []
  const result = await runAgent({
    root,
    config,
    model,
    tools: [
      ...fileTools(),
      verificationTool(config, await projectFingerprint(root, config)),
    ],
    trusted: true,
    prompt: 'Add a counter page and repair its build',
    onEvent: (e) => {
      if (e.type === 'tool.completed' && e.data.name === 'verify_project') {
        checks.push(e.data.result.data)
      }
    },
  })
  assert.equal(result.status, 'completed')
  assert.equal(
    checks[0].passed,
    false,
    'The intentionally invalid source must fail the real build',
  )
  assert.equal(
    checks[1].passed,
    true,
    'The agent repair must restore the real build',
  )
  const app = JSON.parse(
    await readFile(path.join(root, 'dist/app.json'), 'utf8'),
  )
  assert(
    app.pages.includes(route),
    'New page must be registered in the compiled app',
  )
  assert.equal((await detectProject(root)).kind, kind)
  const resumed = await runAgent({
    root,
    config,
    model: {
      id: 'resume',
      async* stream() {
        yield { type: 'text', text: 'Session recovered without replay' }
      },
    },
    tools: fileTools(),
    prompt: 'Review',
    sessionId: result.sessionId,
  })
  assert.equal(resumed.status, 'completed')
  results.push({
    kind,
    status: 'passed',
    realBuildFailureDetected: true,
    repaired: true,
    registered: true,
    sessionResumed: true,
    runtime: 'unverified',
  })
}
const artifacts = path.resolve(import.meta.dirname, '../../artifacts/weapp-agent')
await mkdir(artifacts, { recursive: true })
await writeFile(
  path.join(artifacts, 'fixtures.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
