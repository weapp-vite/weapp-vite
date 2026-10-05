import type { ManagedWechatWindowCloseEvidence } from '../types'
import { z } from 'zod'

const text = z.string().min(1)
const cursorSchema = z.object({
  name: z.string().regex(/^[^/\\]+\.log$/),
  identity: text,
  offset: z.number().int().nonnegative(),
  anchor: z.string().regex(/^[a-f0-9]{64}$/),
  skipPartialLine: z.boolean(),
})
const callSchema = z.object({
  fileIdentity: text,
  winId: text,
  browserWindowId: z.number().int().positive(),
  calledAt: text,
  cancelled: z.boolean().optional(),
})

export const managedWindowCloseSchema = z.object({
  protocol: z.literal('wechat-devtools-window-close-trace-v1'),
  profileDir: text,
  productVersion: text,
  capturedAt: text,
  dispatchedAt: text.optional(),
  cursors: z.array(cursorSchema).min(1),
  calls: z.array(callSchema),
  window: callSchema.extend({
    runtimeId: text,
    requestedAt: text,
    nativeClosedAt: text.optional(),
    webContentsDestroyedAt: text.optional(),
  }).optional(),
  failure: text.optional(),
  logInventoryRecovery: z.object({ failure: text, cursors: z.array(cursorSchema).min(1) }).optional(),
}) satisfies z.ZodType<ManagedWechatWindowCloseEvidence>
