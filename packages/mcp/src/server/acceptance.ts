import type { McpServer } from '@modelcontextprotocol/server'
import type { AcceptanceService } from '@weapp-vite/acceptance'
import { redactor, redactValue } from '@weapp-vite/acceptance'
import { z } from 'zod'

export function registerAcceptanceTools(server: McpServer, service: () => Promise<AcceptanceService>) {
  const json = (data: unknown) => {
    const structuredContent = redactValue(data) as Record<string, unknown>
    return { content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }], structuredContent }
  }
  const guarded = (fn: (args: any) => Promise<any>) => async (args: any) => {
    try {
      return await fn(args)
    }
    catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: redactor()(error instanceof Error ? error.message : String(error)) }] }
    }
  }
  const jobId = z.uuid()
  server.registerTool('weapp_project_inspect', {
    description: 'Inspect mini-program support, configured acceptance and missing prerequisites. No model or runtime startup.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, guarded(async () => json(await (await service()).inspect())))
  server.registerTool('weapp_acceptance_start', {
    description: 'Start configured checks and deterministic WeChat DevTools scenarios. Returns a jobId immediately. Requires previously reviewed project trust; no model calls or code edits.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, guarded(async () => json(await (await service()).start())))
  server.registerTool('weapp_acceptance_status', {
    description: 'Get current acceptance progress and source freshness. Poll until status is no longer running.',
    inputSchema: z.object({ jobId }),
    annotations: { readOnlyHint: true },
  }, guarded(async ({ jobId }) => {
    const report = await (await service()).report(jobId)
    return json({ version: report.version, jobId, status: report.status, passed: report.passed, snapshot: report.snapshot, checks: report.checks.map(({ output: _output, ...check }) => check), lastStep: report.steps.at(-1), reason: report.reason })
  }))
  server.registerTool('weapp_acceptance_cancel', {
    description: 'Cancel an acceptance task owned by this server. Completed interactions are not undone or replayed.',
    inputSchema: z.object({ jobId }),
    annotations: { readOnlyHint: false, idempotentHint: true },
  }, guarded(async ({ jobId }) => json(await (await service()).cancel(jobId))))
  server.registerTool('weapp_acceptance_report', {
    description: 'Read the version 2 acceptance report, or one named screenshot/console artifact from that report. Evidence may be stale; inspect snapshot.stale before claiming success.',
    inputSchema: z.object({ jobId, artifact: z.string().optional() }),
    annotations: { readOnlyHint: true },
  }, guarded(async ({ jobId, artifact }) => {
    if (!artifact) {
      return json(await (await service()).report(jobId))
    }
    const result = await (await service()).artifact(jobId, artifact)
    const report = await (await service()).report(jobId)
    return {
      ...json({ jobId, artifact, status: report.status, stale: report.snapshot.stale }),
      content: [
        { type: 'text', text: JSON.stringify({ jobId, artifact, status: report.status, stale: report.snapshot.stale }) },
        result.mediaType === 'image/png'
          ? { type: 'image', data: result.data, mimeType: result.mediaType }
          : { type: 'text', text: result.data },
      ],
    }
  }))
  return server
}
