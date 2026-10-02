import type {
  ProjectConfig,
  Tool,
  ToolContext,
  VerificationCommand,
} from '@weapp-agent/core/project'

import {
  authorize,
  bounded,
  projectFingerprint,
  requireTrust,
} from '@weapp-agent/core/project'

// eslint-disable-next-line e18e/ban-dependencies -- Preserve cross-platform command resolution, cancellation and process cleanup semantics.
import { execa } from 'execa'

import { z } from 'zod'

export interface CheckResult {
  kind: VerificationCommand['kind']
  status: 'passed' | 'failed' | 'unverified'
  command?: string
  exitCode?: number
  timedOut?: boolean
  output: string
}

export interface VerificationReport {
  passed: boolean
  checks: CheckResult[]
}

export async function verifyProject(
  config: ProjectConfig,
  context: ToolContext,
  originalFingerprint: string,
  onCheck?: (check: CheckResult) => Promise<void>,
  skipKinds: CheckResult['kind'][] = [],
): Promise<VerificationReport> {
  await requireTrust(context)

  const checks: CheckResult[] = []

  for (const command of config.verification.filter(c => !skipKinds.includes(c.kind))) {
    context.signal.throwIfAborted()

    const current = await projectFingerprint(context.root, config)

    if (
      current !== originalFingerprint
      || /publish|upload|deploy/i.test(
        [command.command, ...command.args].join(' '),
      )
    ) {
      await authorize(
        context,
        'command',
        `Verify: ${command.command} ${command.args.join(' ')}`,
        { command, fingerprint: current },
      )
    }

    const result = await execa(command.command, command.args, {
      cwd: context.root,
      cancelSignal: context.signal,
      timeout: command.timeoutMs,
      forceKillAfterDelay: 2000,
      killDescendants: true,
      reject: false,
      maxBuffer: 2_000_000,
    })

    context.signal.throwIfAborted()

    checks.push({
      kind: command.kind,
      status: result.failed ? 'failed' : 'passed',
      command: `${command.command} ${command.args.join(' ')}`,
      exitCode: result.exitCode,
      ...(result.timedOut ? { timedOut: true } : {}),
      output: bounded(result.timedOut ? `Verification command timed out after ${command.timeoutMs}ms.\n${result.stdout}\n${result.stderr}` : `${result.stdout}\n${result.stderr}`),
    })

    await onCheck?.(checks[checks.length - 1]!)
  }

  for (const kind of ['typecheck', 'build', 'test', 'devtools'] as const) {
    if (!checks.some(c => c.kind === kind)) {
      checks.push({
        kind,
        status: 'unverified',
        output:
          kind === 'devtools'
            ? 'No real DevTools verification command configured. Web preview is not WeChat runtime evidence.'
            : 'No verification command configured.',
      })
    }
  }

  return {
    passed:
      checks.some(c => c.status === 'passed')
      && !checks.some(c => c.status === 'failed'),
    checks,
  }
}

export function verificationTool(
  config: ProjectConfig,
  fingerprint: string,
): Tool {
  return {
    name: 'verify_project',
    description:
      'Run configured typecheck/build/test/DevTools commands and return separate passed, failed and unverified results. Fix failures, then rerun. Missing checks are never considered passed.',
    schema: z.strictObject({}),
    mutates: true,
    async execute(_input, context) {
      const report = await verifyProject(config, context, fingerprint)

      return { text: JSON.stringify(report, null, 2), data: report }
    },
  }
}
