import { createHash } from 'node:crypto'

import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'

import { homedir } from 'node:os'

import path from 'node:path'

import process from 'node:process'

import { z } from 'zod'

import { safePath } from './security.js'

export const verificationSchema = z.strictObject({
  kind: z.enum(['typecheck', 'build', 'test', 'devtools']),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().max(1_800_000).default(120_000),
})

export const mcpSchema = z.discriminatedUnion('transport', [
  z.strictObject({
    name: z.string().regex(/^[\w-]+$/),
    transport: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).default([]),
  }),
  z.strictObject({
    name: z.string().regex(/^[\w-]+$/),
    transport: z.literal('http'),
    url: z.url(),
    tokenEnv: z.string().optional(),
  }),
])

const modelSchema = z.strictObject({
  provider: z.enum(['openai', 'anthropic', 'openai-compatible']),
  name: z.string().min(1),
  baseURL: z.url().optional(),
  apiKeyEnv: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/)
    .optional(),
})

export const projectConfigSchema = z.strictObject({
  version: z.literal(1).default(1),
  model: modelSchema.optional(),
  maxSteps: z.number().int().min(1).max(500).default(40),
  timeoutMs: z.number().int().positive().default(600_000),
  contextCharacters: z.number().int().min(8000).default(100_000),
  verification: z.array(verificationSchema).default([]),
  mcp: z.array(mcpSchema).default([]),
  acceptance: z.strictObject({
    requiredChecks: z.array(z.enum(['typecheck', 'build', 'test', 'devtools'])).min(1).default(['build', 'devtools']),
    scenarios: z.array(z.string().min(1)).max(100).default([]),
    timeoutMs: z.number().int().min(100).max(1_800_000).default(600_000),
  }).default({ requiredChecks: ['build', 'devtools'], scenarios: [], timeoutMs: 600_000 }),
})

export const configSchema = projectConfigSchema.extend({ model: modelSchema })

export type ProjectConfig = z.infer<typeof projectConfigSchema>

export type AgentConfig = z.infer<typeof configSchema>

export type VerificationCommand = z.infer<typeof verificationSchema>

export type McpConfig = z.infer<typeof mcpSchema>

export const configFilename = 'weapp-agent.config.json'

export const acceptanceConfigFilename = 'weapp-acceptance.config.json'

const selectedConfigs = new WeakMap<ProjectConfig, string>()

export function configurationSource(config: ProjectConfig): string | undefined {
  return selectedConfigs.get(config)
}

export async function loadAcceptanceConfig(root: string, explicit?: string): Promise<ProjectConfig | undefined> {
  for (const file of explicit ? [explicit] : [acceptanceConfigFilename, configFilename]) {
    const target = await safePath(root, file)

    let raw: string

    try {
      raw = await readFile(target, 'utf8')
    }
    catch (error) {
      if (!explicit && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }

      throw error
    }

    const schema = file === configFilename ? projectConfigSchema : projectConfigSchema.pick({ version: true, verification: true, acceptance: true })

    const config = projectConfigSchema.parse(schema.parse(JSON.parse(raw)))

    selectedConfigs.set(config, path.relative(await realpath(root), target))

    return config
  }
}

export async function loadProjectConfig(root: string): Promise<ProjectConfig> {
  let raw: string

  try {
    raw = await readFile(path.join(root, configFilename), 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }

    throw new Error(
      `Missing ${configFilename}. Run weapp-agent init; add --model <model> only for independent agent mode.`,
    )
  }

  return projectConfigSchema.parse(JSON.parse(raw))
}

export async function loadConfig(root: string): Promise<AgentConfig> {
  const config = await loadProjectConfig(root)

  if (!config.model) {
    throw new Error('Agent mode requires model configuration. Set model.provider and model.name in weapp-agent.config.json. Acceptance and MCP do not require a model.')
  }

  return configSchema.parse(config)
}

export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function stateRoot(): string {
  return path.resolve(
    process.env.WEAPP_AGENT_STATE_DIR
    ?? path.join(homedir(), '.local', 'state', 'weapp-agent'),
  )
}

export async function projectFingerprint(
  root: string,
  config: ProjectConfig,
): Promise<string> {
  let pkg = ''

  try {
    pkg = await readFile(path.join(root, 'package.json'), 'utf8')
  }
  catch {

    /* Native projects may have no package.json. */

  }

  let diskConfig = ''

  try {
    diskConfig = await readFile(await safePath(root, configurationSource(config) ?? configFilename), 'utf8')
  }
  catch {

    /* Programmatic callers may supply configuration without a file. */

  }

  const scenarios: Array<[string, string]> = []

  for (const file of config.acceptance.scenarios) {
    const target = await safePath(root, file)

    try {
      scenarios.push([file, await readFile(target, 'utf8')])
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }

      scenarios.push([file, '<missing>'])
    }
  }

  const projectFiles: Array<[string, string]> = []

  for (const file of ['project.config.json', 'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs', 'vite.config.cts', 'vite.config.cjs', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock']) {
    try {
      projectFiles.push([file, hash(await readFile(await safePath(root, file), 'utf8'))])
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  return hash(JSON.stringify({ root, config, pkg, diskConfig, scenarios, projectFiles, ...(configurationSource(config) && configurationSource(config) !== configFilename ? { configurationSource: configurationSource(config) } : {}) }))
}

export async function isTrusted(
  root: string,
  fingerprint: string,
): Promise<boolean> {
  try {
    const trust = JSON.parse(
      await readFile(
        path.join(stateRoot(), 'trust', `${hash(root)}.json`),
        'utf8',
      ),
    )

    return trust.fingerprint === fingerprint
  }
  catch {
    return false
  }
}

export async function trustProject(
  root: string,
  fingerprint: string,
): Promise<void> {
  const dir = path.join(stateRoot(), 'trust')

  await mkdir(dir, { recursive: true, mode: 0o700 })

  await writeFile(
    path.join(dir, `${hash(root)}.json`),
    JSON.stringify({ root, fingerprint }),
    { mode: 0o600 },
  )
}
