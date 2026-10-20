import { z } from 'zod'

export const managedSnapshotSchema = z.object({
  protocol: z.literal('wechat-devtools-project-snapshot-v1'),
  sourceProjectPath: z.string().min(1),
  token: z.string().uuid(),
  state: z.enum(['reserved', 'ready', 'removed']),
  directoryIdentity: z.object({ dev: z.string().min(1), ino: z.string().min(1) }).strict().optional(),
  dispatchedAt: z.string().datetime().optional(),
  cleanupStartedAt: z.string().datetime().optional(),
  removedAt: z.string().datetime().optional(),
  cleanupError: z.string().optional(),
}).strict()
