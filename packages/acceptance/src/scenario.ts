import type { ToolContext } from '@weapp-agent/core/project'
import type { RuntimeConnection } from './runtime.js'
import { setTimeout } from 'node:timers/promises'
import { z } from 'zod'

const selector = z.string().trim().min(1)
const timeoutMs = z.number().int().min(100).max(60_000).default(5000)
export const scenarioSchema = z.strictObject({
  version: z.literal(1),
  name: z.string().min(1),
  steps: z.array(z.discriminatedUnion('action', [
    z.strictObject({ action: z.literal('route'), path: z.string().startsWith('/') }),
    z.strictObject({ action: z.literal('find'), selector }),
    z.strictObject({ action: z.literal('tap'), selector }),
    z.strictObject({ action: z.literal('input'), selector, value: z.string() }),
    z.strictObject({ action: z.literal('wait'), selector, timeoutMs }),
    z.strictObject({ action: z.literal('assert'), selector, text: z.string(), timeoutMs }),
    z.strictObject({ action: z.literal('screenshot') }),
  ])).min(1).max(100),
}).refine(s => s.steps[0]?.action === 'route', 'Start each scenario with a route step').refine(s => s.steps.some(step => step.action === 'assert'), 'Each scenario requires an explicit assertion')
export type Scenario = z.infer<typeof scenarioSchema>
export interface ScenarioStepResult {
  scenario: string
  index: number
  action: string
  status: 'running' | 'passed' | 'failed'
  startedAt: string
  finishedAt?: string
  input: unknown
  actual?: unknown
  error?: string
}

/** A task owns one connection; all operations use the same scoped runtime. */
export function runtimeInvoker(connection: RuntimeConnection, context: ToolContext) {
  return async (name: string, args: Record<string, unknown>): Promise<Record<string, any>> => {
    context.signal.throwIfAborted()
    const tool = connection.tools.find(t => t.name === `weapp__${name}`)
    if (!tool) {
      throw new Error(`Missing runtime capability: ${name}. Check the installed weapp-vite version.`)
    }
    const result = await tool.execute(args, context)
    const data = result.data ?? JSON.parse(result.text)
    if (!data || typeof data !== 'object' || !('result' in data)) {
      throw new Error(`Invalid runtime result: ${name}`)
    }
    return data.result as Record<string, any>
  }
}
export async function runScenario(
  scenario: Scenario,
  invoke: ReturnType<typeof runtimeInvoker>,
  context: ToolContext,
  onStep: (step: ScenarioStepResult) => Promise<void>,
  capture: () => Promise<string>,
): Promise<void> {
  const scope = { projectPath: context.root, preserveProjectRoot: true }
  for (const [index, step] of scenario.steps.entries()) {
    context.signal.throwIfAborted()
    const result: ScenarioStepResult = {
      scenario: scenario.name,
      index,
      action: step.action,
      input: step,
      status: 'running',
      startedAt: new Date().toISOString(),
    }
    // Persist intent before side effects. Recovery never replays these steps.
    await onStep(result)
    try {
      switch (step.action) {
        case 'route':
          result.actual = await invoke('weapp_devtools_route', { ...scope, path: step.path, transition: 'reLaunch' })
          break
        case 'find':
          result.actual = await invoke('weapp_runtime_find_node', { ...scope, selector: step.selector })
          break
        case 'tap':
          result.actual = await invoke('weapp_runtime_tap_node', { ...scope, selector: step.selector })
          break
        case 'input':
          result.actual = await invoke('weapp_runtime_input_node', { ...scope, selector: step.selector, value: step.value })
          break
        case 'wait':
          result.actual = await invoke('weapp_runtime_wait_node', { ...scope, selector: step.selector, timeoutMs: step.timeoutMs })
          break
        case 'assert': {
          const deadline = Date.now() + step.timeoutMs
          for (;;) {
            // Only observations are retried, never taps, input or navigation.
            const actual = await invoke('weapp_runtime_find_node', { ...scope, selector: step.selector })
            result.actual = actual
            if (actual.text === step.text) {
              break
            }
            if (Date.now() >= deadline) {
              throw new Error(`Assertion failed for ${step.selector}: expected ${JSON.stringify(step.text)}, received ${JSON.stringify(actual.text)}`)
            }
            await setTimeout(100, undefined, { signal: context.signal })
          }
          break
        }
        case 'screenshot':
          result.actual = { artifact: await capture(), purpose: 'visual evidence, not a visual assertion' }
          break
      }
      result.status = 'passed'
    }
    catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : String(error)
      throw error
    }
    finally {
      result.finishedAt = new Date().toISOString()
      await onStep(result)
    }
  }
}
