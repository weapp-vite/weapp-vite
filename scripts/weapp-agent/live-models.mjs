import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- Preserve cross-platform command resolution, cancellation and process cleanup semantics.
import { execa } from 'execa'

const repository = path.resolve(import.meta.dirname, '../..')
const results = []
for (const provider of ['openai', 'anthropic']) {
  const key = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'
  const model = process.env[`WEAPP_AGENT_${provider.toUpperCase()}_MODEL`]
  if (!process.env[key] || !model) {
    results.push({
      provider,
      status: 'unverified',
      reason: `Requires ${key} and WEAPP_AGENT_${provider.toUpperCase()}_MODEL`,
    })
    continue
  }
  const root = await mkdtemp(path.join(tmpdir(), 'weapp-live-'))
  try {
    await writeFile(path.join(root, 'page.js'), 'export const count = 0\n')
    await writeFile(
      path.join(root, 'weapp-agent.config.json'),
      JSON.stringify({
        version: 1,
        model: { provider, name: model },
        maxSteps: 12,
        verification: [
          {
            kind: 'test',
            command: process.execPath,
            args: [
              '-e',
              'const fs=require("fs");if(!fs.readFileSync("page.js","utf8").includes("count = 1"))process.exit(1)',
            ],
          },
        ],
      }),
    )
    const result = await execa(
      process.execPath,
      [
        path.join(repository, 'packages/agent-cli/dist/index.mjs'),
        '-C',
        root,
        '--trust',
        'run',
        'Change count from 0 to 1 in page.js using read_file and edit_file, then verify_project. Do not use shell.',
        '--json',
      ],
      {
        reject: false,
        env: {
          ...process.env,
          WEAPP_AGENT_STATE_DIR: path.join(root, 'state'),
        },
        timeout: 180_000,
      },
    )
    const events = result.stdout
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line))
    const verified = events.some(
      e =>
        e.type === 'tool.completed'
        && e.data.name === 'verify_project'
        && e.data.result?.data?.passed,
    )
    results.push({
      provider,
      status:
        result.exitCode === 0
        && verified
        && (await readFile(path.join(root, 'page.js'), 'utf8')).includes(
          'count = 1',
        )
          ? 'passed'
          : 'failed',
      exitCode: result.exitCode,
      tools: events
        .filter(e => e.type === 'tool.completed')
        .map(e => e.data.name),
    })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}
await mkdir(path.join(repository, 'artifacts'), { recursive: true })
await writeFile(
  path.join(repository, 'artifacts/live-models.json'),
  JSON.stringify(results, null, 2),
)
console.log(JSON.stringify(results, null, 2))
if (results.some(result => result.status !== 'passed')) {
  process.exitCode = 1
}
