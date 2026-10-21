import type { VerificationProfile } from './types'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'

export const verificationProfileSchema = z.object({
  os: z.enum(['darwin', 'linux', 'win32']),
  nodeMajor: z.number().int().min(22),
  provider: z.enum(['none', 'headless', 'devtools']),
  platform: z.string().min(1),
  runnerClass: z.string().min(1),
  arch: z.string().min(1).optional(),
}).strict()

export function currentVerificationProfile(suite: string, env = process.env): VerificationProfile {
  return verificationProfileSchema.parse({
    os: process.platform,
    nodeMajor: Number(process.versions.node.split('.')[0]),
    provider: suite.startsWith('ide') || suite.startsWith('bun-')
      ? env.WEAPP_VITE_E2E_RUNTIME_PROVIDER || (suite.includes('headless') ? 'headless' : 'devtools')
      : 'none',
    platform: env.E2E_PLATFORM || 'weapp',
    runnerClass: env.WEAPP_VITE_E2E_RUNNER_CLASS || (env.GITHUB_ACTIONS ? 'github-hosted' : 'local'),
    arch: process.arch,
  })
}

export function assertVerificationProfile(expected: VerificationProfile, actual: VerificationProfile) {
  if (!isDeepStrictEqual(expected, actual)) {
    throw new Error('Verification profile mismatch: OS, Node, provider, platform, runner class and architecture must match')
  }
}
