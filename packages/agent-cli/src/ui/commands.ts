import type { Approver, RunResult, SessionEvent } from '@weapp-agent/core'

export type InteractiveRunner = (
  prompt: string,
  sessionId: string | undefined,
  signal: AbortSignal,
  onEvent: (event: SessionEvent) => void,
  approve: Approver,
  options?: { acknowledgeInterrupted?: boolean },
) => Promise<RunResult>

export async function runInteractiveTask(
  runner: InteractiveRunner,
  prompt: string,
  sessionId: string | undefined,
  signal: AbortSignal,
  onEvent: (event: SessionEvent) => void,
  approve: Approver,
): Promise<RunResult> {
  const input = prompt.trim()
  const command = input.split(/\s/, 1)[0]
  const acknowledgement = command === '/acknowledge-interrupted'
  if (acknowledgement && !sessionId) {
    throw new Error('No session to recover. Start a task before acknowledging interrupted tool calls.')
  }
  return runner(
    acknowledgement
      ? input.slice('/acknowledge-interrupted'.length).trim() || 'I inspected the interrupted tool outcomes. Continue after checking the current project state.'
      : prompt,
    sessionId,
    signal,
    onEvent,
    approve,
    { acknowledgeInterrupted: Boolean(acknowledgement) },
  )
}
