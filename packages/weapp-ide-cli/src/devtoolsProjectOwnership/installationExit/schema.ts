import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { isPermittedInstallationReplacement, replacementTargetSchema } from './replacement'

const processInspectionSchema = z.object({
  platform: z.literal('darwin'),
  installationRoot: z.string().min(1),
  checkedAt: z.string().datetime(),
  inspectedProcessCount: z.number().int().nonnegative(),
  kernelPathProcessCount: z.number().int().nonnegative(),
  textImageProcessCount: z.number().int().nonnegative(),
  exitedProcessCount: z.number().int().nonnegative(),
  zombieProcessCount: z.number().int().nonnegative(),
  selectedProcessCount: z.literal(0),
}).strict()

export const installationExitRecoverySchema = z.object({
  protocol: z.literal('wechat-devtools-installation-exit-v1'),
  recoveredAt: z.string().datetime(),
  recoveryScopeId: z.string().uuid(),
  journalScopeId: z.string().uuid(),
  journalRootPath: z.string().min(1),
  installationId: z.string().min(1),
  profileDir: z.string().min(1),
  previous: z.object({
    state: z.enum(['starting', 'unconfirmed', 'failed', 'borrowed']),
    error: z.string().optional(),
    updatedAt: z.string().min(1),
    recordSha256: z.string().regex(/^[\da-f]{64}$/),
  }).strict(),
  stoppedOwnerPids: z.array(z.number().int().positive()).min(1),
  closedPorts: z.array(z.number().int().min(1).max(65535)).min(1),
  processInspection: processInspectionSchema,
  replacement: z.object({
    protocol: z.literal('wechat-devtools-installation-replacement-exit-v1'),
    originalTarget: replacementTargetSchema,
    replacementTarget: replacementTargetSchema,
    stoppedHostPids: z.array(z.number().int().positive()),
    exitInspections: z.tuple([processInspectionSchema, processInspectionSchema]),
  }).strict().optional(),
}).strict().refine(evidence => !evidence.replacement || (
  isPermittedInstallationReplacement(evidence.replacement.originalTarget, evidence.replacement.replacementTarget)
  && evidence.replacement.originalTarget.installationId === evidence.installationId
  && evidence.replacement.originalTarget.profileDir === evidence.profileDir
  && evidence.replacement.exitInspections[0].installationRoot === evidence.processInspection.installationRoot
  && isDeepStrictEqual(evidence.replacement.exitInspections[1], evidence.processInspection)
), { message: 'Installation replacement recovery requires matching identity and both exit inspections.' })
