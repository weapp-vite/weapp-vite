import { z } from 'zod'

export const installationExitRecoverySchema = z.object({
  protocol: z.literal('wechat-devtools-installation-exit-v1'),
  recoveredAt: z.string().datetime(),
  recoveryScopeId: z.string().uuid(),
  journalScopeId: z.string().uuid(),
  journalRootPath: z.string().min(1),
  installationId: z.string().min(1),
  profileDir: z.string().min(1),
  previous: z.object({
    state: z.enum(['starting', 'unconfirmed']),
    error: z.string().optional(),
    updatedAt: z.string().min(1),
    recordSha256: z.string().regex(/^[\da-f]{64}$/),
  }).strict(),
  stoppedOwnerPids: z.array(z.number().int().positive()).min(1),
  closedPorts: z.array(z.number().int().min(1).max(65535)).min(1),
  processInspection: z.object({
    platform: z.literal('darwin'),
    installationRoot: z.string().min(1),
    checkedAt: z.string().datetime(),
    inspectedProcessCount: z.number().int().nonnegative(),
    kernelPathProcessCount: z.number().int().nonnegative(),
    textImageProcessCount: z.number().int().nonnegative(),
    exitedProcessCount: z.number().int().nonnegative(),
    zombieProcessCount: z.number().int().nonnegative(),
    selectedProcessCount: z.literal(0),
  }).strict(),
}).strict()
