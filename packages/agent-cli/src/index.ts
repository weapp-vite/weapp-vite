import type {
  Approver,
  ImageInput,
  SessionEvent,
  ToolContext,
} from '@weapp-agent/core'

import type { McpConnection } from '@weapp-agent/mini-program'

import { Buffer } from 'node:buffer'

import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'

import path from 'node:path'

import process from 'node:process'

import { createInterface } from 'node:readline/promises'

import {
  configFilename,
  configSchema,
  fileTools,
  isTrusted,
  loadConfig,
  projectConfigSchema,
  projectFingerprint,
  redactor,
  runAgent,
  stateRoot,
  trustProject,
} from '@weapp-agent/core'

import {
  AcceptanceService,
  builtinMcp,
  connectMcp,
  defaultVerification,
  detectProject,
  exists,
  findProjectRoot,
  resolveProjectConfig,
  serveAcceptanceMcp,
  verificationTool,
  verifyProject,
  WeappProjectAdapter,
} from '@weapp-agent/mini-program'

import { apiKeyVariable, createModel } from '@weapp-agent/providers'

import { Command, Option } from 'commander'

// eslint-disable-next-line e18e/ban-dependencies -- Preserve cross-platform command resolution, cancellation and process cleanup semantics.
import { execa } from 'execa'

import { registerSessionCommands } from './commands/session.js'
import { eventText, interactive } from './ui.js'

const clean = redactor()

const program = new Command()
  .name('weapp-agent')
  .description('AI coding agent for WeChat mini-programs')
  .version('0.1.0-preview.1')
  .option('-C, --cwd <directory>', 'project directory', process.cwd())
  .option('--trust', 'trust this exact project configuration and scripts')
  .option(
    '--json',
    'emit machine-readable JSON; disable interactive approvals',
  )

async function terminalApproval(summary: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false
  }

  const reader = createInterface({
    input: process.stdin,
    output: process.stderr,
  })

  try {
    return /^y(?:es)?$/i.test(
      (await reader.question(`${summary}\nAllow? [y/N] `)).trim(),
    )
  }
  finally {
    reader.close()
  }
}

const approve: Approver = request => terminalApproval(clean(request.summary))

function output(value: unknown, json: boolean): void {
  process.stdout.write(
    `${clean(json ? JSON.stringify(value) : typeof value === 'string' ? value : JSON.stringify(value, null, 2))}\n`,
  )
}

async function configAndTrust(
  root: string,
  options: { trust?: boolean, json?: boolean },
  approver: Approver,
  agent = true,
) {
  const config = agent ? await loadConfig(root) : await resolveProjectConfig(root)

  const fingerprint = await projectFingerprint(root, config)

  let trusted = await isTrusted(root, fingerprint)

  if (options.trust) {
    await trustProject(root, fingerprint)

    trusted = true
  }
  else
    if (!trusted && !options.json) {
      const summary = `Trust ${root}?\nThis permits local edits, configured scripts and MCP server startup.\n${JSON.stringify({ verification: config.verification, mcp: config.mcp }, null, 2)}`

      if (await approver({ kind: 'trust', summary, fingerprint })) {
        await trustProject(root, fingerprint)

        trusted = true
      }
    }

  return { config, fingerprint, trusted }
}

async function images(files: string[]): Promise<ImageInput[]> {
  return Promise.all(
    files.map(async (file) => {
      const data = await readFile(path.resolve(file))

      if (data.length > 10 * 1024 * 1024) {
        throw new Error(`Image exceeds 10 MB: ${file}`)
      }

      const type = data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'image/png'
        : data[0] === 255 && data[1] === 216
          ? 'image/jpeg'
          : data.subarray(8, 12).toString() === 'WEBP'
            ? 'image/webp'
            : undefined

      if (!type) {
        throw new Error(`Use a PNG, JPEG or WebP image: ${file}`)
      }

      return { type: 'image', data: data.toString('base64'), mediaType: type }
    }),
  )
}

async function execute(
  prompt: string,
  options: Record<string, any>,
  sessionId?: string,
  suppliedSignal?: AbortSignal,
  onEvent?: (event: SessionEvent) => void,
  approver: Approver = approve,
) {
  const root = await findProjectRoot(options.cwd)

  const selectedApprover: Approver = options.json
    ? async () => false
    : approver

  const { config, fingerprint, trusted } = await configAndTrust(
    root,
    options,
    selectedApprover,
  )

  const agentConfig = configSchema.parse(config)

  const model = createModel(agentConfig.model)

  const adapter = new WeappProjectAdapter()

  const project = await adapter.detect(root)

  const abort = new AbortController()

  const stop = () => abort.abort()

  if (!suppliedSignal) {
    process.once('SIGINT', stop)
  }

  const signal = suppliedSignal ?? abort.signal

  const context: ToolContext = {
    root,
    trusted,
    approve: selectedApprover,
    signal,
  }

  const connections: McpConnection[] = []

  const warnings: string[] = []

  try {
    const tools = [
      ...fileTools(),
      ...(await adapter.tools(project)),
      verificationTool(config, fingerprint),
    ]

    const automatic = trusted ? await builtinMcp(root) : undefined

    const servers = [
      ...config.mcp,
      ...(automatic && !config.mcp.some(s => s.name === automatic.name)
        ? [automatic]
        : []),
    ]

    for (const server of servers) {
      try {
        const connection = await connectMcp(server, context, {
          config,
          fingerprint,
          builtin: server === automatic,
        })

        connections.push(connection)

        tools.push(...connection.tools)
      }
      catch (error) {
        warnings.push(
          `MCP ${server.name} unavailable: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    const attached = await images(options.image ?? [])

    return await runAgent({
      root,
      config: agentConfig,
      model,
      tools,
      prompt,
      images: attached,
      sessionId,
      signal,
      trusted,
      approve: selectedApprover,
      acknowledgeInterrupted: options.acknowledgeInterrupted,
      system: `${await adapter.instructions(project)}\nUnavailable capabilities:\n${warnings.join('\n')}`,
      onEvent: async (event) => {
        if (onEvent) {
          onEvent(event)
        }
        else
          if (options.json) {
            output(event, true)
          }
          else {
            if (event.type === 'run.started') {
              process.stderr.write(
                `Session: ${event.sessionId}\n${warnings.join('\n')}\n`,
              )
            }

            process.stdout.write(clean(eventText(event)))
          }
      },
    })
  }
  finally {
    if (!suppliedSignal) {
      process.removeListener('SIGINT', stop)
    }

    await Promise.allSettled(connections.map(c => c.close()))
  }
}

function exitFor(status: string): void {
  process.exitCode
    = (
      {
        completed: 0,
        failed: 1,
        action_required: 2,
        limit_reached: 3,
        cancelled: 130,
      } as Record<string, number>
    )[status] ?? 1
}

program
  .command('init')
  .description('Configure an existing project, or scaffold one with --create')
  .argument('[directory]', 'target directory')
  .option('--create', 'create a new weapp-vite project; target must not exist')
  .addOption(
    new Option('--template <template>', 'new project template')
      .choices(['wevu', 'native'])
      .default('wevu'),
  )
  .addOption(
    new Option('--provider <provider>', 'model provider')
      .choices(['openai', 'anthropic', 'openai-compatible'])
      .default('openai'),
  )
  .option(
    '--model <model>',
    'model identifier; no hard-coded model default',
  )
  .option('--base-url <url>', 'custom provider endpoint')
  .option('--api-key-env <name>', 'environment variable containing the API key')
  .action(async (directory, local, command) => {
    const opts = command.optsWithGlobals()

    const root = path.resolve(directory ?? opts.cwd)

    if (local.create) {
      if (await exists(root)) {
        throw new Error(
          'Creation target already exists; refusing to overwrite it.',
        )
      }

      await execa(
        'pnpm',
        [
          'dlx',
          'create-weapp-vite@3.0.1',
          root,
          local.template === 'native' ? 'default' : 'wevu',
          '--no-install-skills',
        ],
        { stdio: opts.json ? ['ignore', 'pipe', 'pipe'] : 'inherit' },
      )
    }
    else {
      await mkdir(root, { recursive: true })
    }

    const project = await detectProject(root)

    const config = projectConfigSchema.parse({
      model: local.model
        ? {
            provider: local.provider,
            name: local.model,
            baseURL: local.baseUrl,
            apiKeyEnv: local.apiKeyEnv,
          }
        : undefined,
      verification: defaultVerification(project),
    })

    await writeFile(
      path.join(root, configFilename),
      `${JSON.stringify(config, null, 2)}\n`,
      { flag: 'wx' },
    )

    output(
      {
        status: 'created',
        root,
        config: configFilename,
        next: config.model ? `Set ${apiKeyVariable(config.model)}, install project dependencies, then run weapp-agent --trust.` : 'Review project scripts, then run weapp-agent --trust accept. Configure acceptance.scenarios for runtime checks. No model key is required.',
      },
      opts.json,
    )
  })

program
  .command('run')
  .description('Run a single task')
  .argument('<prompt>')
  .option('--image <file...>', 'reference screenshots')
  .action(async (prompt, _local, command) => {
    const options = command.optsWithGlobals()

    const result = await execute(prompt, options)

    if (!options.json && result.status !== 'completed') {
      output(result.text, false)
    }

    exitFor(result.status)
  })

program
  .command('resume')
  .description('Resume a saved session without replaying completed tools')
  .argument('<session>')
  .argument(
    '[prompt]',
    'follow-up task',
    'Continue the task after inspecting the current project state.',
  )
  .option(
    '--acknowledge-interrupted',
    'confirm inspection of interrupted tool outcomes; do not replay them',
  )
  .option('--image <file...>')
  .action(async (session, prompt, _local, command) => {
    const options = command.optsWithGlobals()

    const result = await execute(prompt, options, session)

    if (!options.json && result.status !== 'completed') {
      output(result.text, false)
    }

    exitFor(result.status)
  })

registerSessionCommands(program, output)

program
  .command('doctor')
  .description(
    'Inspect configuration and local prerequisites without calling a model',
  )
  .action(async (_local, command) => {
    const opts = command.optsWithGlobals()

    const root = await findProjectRoot(opts.cwd)

    const service = await AcceptanceService.create(root)

    try {
      const config = await resolveProjectConfig(root)

      output({
        ...await service.inspect(),
        node: process.version,
        config: await exists(path.join(root, configFilename)) ? 'valid' : 'inferred',
        apiKey: config.model ? { variable: apiKeyVariable(config.model), present: Boolean(process.env[apiKeyVariable(config.model)]) } : null,
        stateDirectory: stateRoot(),
      }, opts.json)
    }
    finally {
      await service.close()
    }
  })

program
  .command('verify')
  .description('Run configured checks and report unverified categories')
  .action(async (_local, command) => {
    const opts = command.optsWithGlobals()

    const root = await findProjectRoot(opts.cwd)

    const { config, fingerprint, trusted } = await configAndTrust(
      root,
      opts,
      approve,
      false,
    )

    const abort = new AbortController()

    const stop = () => abort.abort()

    process.once('SIGINT', stop)

    try {
      const result = await verifyProject(
        config,
        {
          root,
          trusted,
          signal: abort.signal,
          approve: opts.json ? async () => false : approve,
        },
        fingerprint,
      )

      output(result, opts.json)

      if (!result.passed) {
        process.exitCode = 1
      }
    }
    finally {
      process.removeListener('SIGINT', stop)
    }
  })

program
  .command('skill')
  .description('Copy the bundled acceptance skill into a new directory you choose')
  .argument('<directory>', 'new skill directory, for example .agents/skills/weapp-acceptance')
  .action(async (directory, _local, command) => {
    const opts = command.optsWithGlobals()

    const target = path.resolve(opts.cwd, directory)

    await mkdir(path.dirname(target), { recursive: true })

    await mkdir(target)

    const source = new URL('../skills/weapp-acceptance/', import.meta.url)

    for (const entry of await readdir(source)) {
      await cp(new URL(entry, source), path.join(target, entry), { recursive: true, force: false, errorOnExist: true })
    }

    output({ status: 'installed', directory: target }, opts.json)
  })

program
  .command('accept')
  .description('Run version 2 acceptance without a model; missing required evidence never passes')
  .action(async (_local, command) => {
    const opts = command.optsWithGlobals()

    const service = await AcceptanceService.create(await findProjectRoot(opts.cwd), { trust: opts.trust })

    let jobId: string | undefined

    const stop = () => {
      if (jobId) {
        void service.cancel(jobId).catch(() => {
        })
      }
    }

    process.once('SIGINT', stop)

    process.once('SIGTERM', stop)

    try {
      const started = await service.start()

      jobId = started.jobId

      if (!opts.json) {
        process.stderr.write(`Acceptance: ${jobId}\n`)
      }

      const report = await service.wait(jobId)

      output(report, opts.json)

      process.exitCode = report.passed ? 0 : report.status === 'action_required' || report.status === 'interrupted' ? 2 : report.status === 'cancelled' ? 130 : 1
    }
    finally {
      process.removeListener('SIGINT', stop)

      process.removeListener('SIGTERM', stop)

      await service.close()
    }
  })

program
  .command('report')
  .description('Read a saved acceptance report and recheck source freshness')
  .argument('<jobId>')
  .action(async (jobId, _local, command) => {
    const opts = command.optsWithGlobals()

    const service = await AcceptanceService.create(await findProjectRoot(opts.cwd))

    try {
      output(await service.report(jobId), opts.json)
    }
    finally {
      await service.close()
    }
  })

program
  .command('mcp')
  .description('Serve project inspection and acceptance over stdio MCP; no model required')
  .action(async (_local, command) => {
    const opts = command.optsWithGlobals()

    const service = await AcceptanceService.create(await findProjectRoot(opts.cwd), { trust: opts.trust })

    const server = await serveAcceptanceMcp(service)

    const stop = () => {
      void service.close().then(() => server.close())
    }

    process.once('SIGINT', stop)

    process.once('SIGTERM', stop)
  })

program.action(async () => {
  const options = program.opts()

  if (!process.stdin.isTTY || options.json) {
    throw new Error(
      'Interactive mode requires a TTY. Use weapp-agent run <prompt> --json for automation.',
    )
  }

  let trustOnce = options.trust

  await interactive((prompt, session, signal, onEvent, approval, runOptions) => {
    const current = { ...options, trust: trustOnce, acknowledgeInterrupted: runOptions?.acknowledgeInterrupted }

    trustOnce = false

    return execute(prompt, current, session, signal, onEvent, approval)
  })
})

try {
  // eslint-disable-next-line antfu/no-top-level-await -- Executable CLI entry owns the process lifecycle.
  await program.parseAsync()
}
catch (error) {
  const message = clean(error instanceof Error ? error.message : String(error))

  if (process.argv.includes('--json') && !process.argv.includes('mcp')) {
    output({ version: 1, type: 'error', data: { message } }, true)
  }
  else {
    process.stderr.write(`${message}\n`)
  }

  process.exitCode
    = error instanceof Error && error.name === 'ApprovalRequired' ? 2 : 1
}
