import type { Approval, Approver, SessionEvent } from '@weapp-agent/core'
import type { InteractiveRunner } from './ui/commands.js'
import { redactor } from '@weapp-agent/core'
import { Box, render, Text, useApp, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useRef, useState } from 'react'
import { runInteractiveTask } from './ui/commands.js'

const cleanPreview = redactor()

function safePreview(input: unknown, depth = 0): unknown {
  if (depth > 2) {
    return '[nested data omitted]'
  }
  if (typeof input === 'string') {
    const clean = cleanPreview(input)
      .replace(/data:[^\s,]+,\S+/gi, '[image/data omitted]')
      .replace(/[A-Z0-9+/]{80,}={0,2}/gi, '[binary data omitted]')
    return clean.length > 120 ? `${clean.slice(0, 120)}…` : clean
  }
  if (input === null || typeof input !== 'object') {
    return input
  }
  if (Array.isArray(input)) {
    return input.slice(0, 4).map(item => safePreview(item, depth + 1))
  }
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).slice(0, 8).map(([key, value]) => [
    key,
    /key|token|secret|password|authorization/i.test(key)
      ? '[REDACTED]'
      : /^(?:data|base64|images?|image_url)$/i.test(key)
        ? '[data omitted]'
        : safePreview(value, depth + 1),
  ]))
}

function inputPreview(input: unknown): string {
  if (input === undefined) {
    return ''
  }
  try {
    const serialized = JSON.stringify(safePreview(input))
    if (!serialized) {
      return ''
    }
    return serialized.length > 240 ? `${serialized.slice(0, 240)}…` : serialized
  }
  catch {
    return '[input omitted]'
  }
}

export type { InteractiveRunner } from './ui/commands.js'
export function eventText(event: SessionEvent, mode: 'cli' | 'interactive' = 'cli'): string {
  if (event.type === 'text.delta') {
    return String(event.data.text)
  }
  if (event.type === 'tool.started') {
    return `\n↳ ${event.data.name}\n`
  }
  if (event.type === 'tool.completed') {
    const result = event.data.result as { text?: string }
    const edit = ['edit_file', 'create_file'].includes(String(event.data.name))
    return `${event.data.error ? '✗' : '✓'} ${event.data.name}${edit || event.data.error ? `\n${result.text?.slice(0, 5000)}` : ''}\n`
  }
  if (event.type === 'context.compacted') {
    return '\n· Earlier context summarized\n'
  }
  if (event.type === 'recovery.required') {
    const calls = Array.isArray(event.data.calls)
      ? event.data.calls as Array<{ name: string, state?: string, input?: unknown }>
      : []
    const summary = calls.map((call) => {
      const input = inputPreview(call.input)
      return `  ${call.name}: ${call.state === 'not_executed' ? 'not executed' : 'outcome unknown'}${input ? ` ${input}` : ''}`
    }).join('\n')
    const command = mode === 'interactive'
      ? '/acknowledge-interrupted [follow-up task]'
      : `weapp-agent resume ${event.sessionId} --acknowledge-interrupted [follow-up task]`
    return `\nRecovery requires inspection:\n${summary}\nInspect the working tree and tool outcomes, then enter ${command}. Completed calls will not be replayed.\n`
  }
  if (event.type === 'run.completed') {
    const reason = event.data.reason
    if (event.data.status === 'limit_reached' && reason === 'context_budget') {
      return '\n[limit_reached: context_budget] Increase contextCharacters, then resume the session.\n'
    }
    if (event.data.status === 'limit_reached' && reason === 'max_steps') {
      return '\n[limit_reached: max_steps] Resume the session to continue.\n'
    }
    return `\n[${event.data.status}]\n`
  }
  return ''
}
function App({
  runner,
  initialSession,
}: {
  runner: InteractiveRunner
  initialSession?: string
}) {
  const { exit } = useApp()
  const [input, setInput] = useState('')
  const [transcript, setTranscript] = useState(
    'Describe a mini-program change. /exit to quit. Esc cancels a running task.\n',
  )
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState(initialSession)
  const [pending, setPending] = useState<Approval>()
  const answer = useRef<(approved: boolean) => void>(() => {})
  const controller = useRef<AbortController | undefined>(undefined)
  const append = (text: string) =>
    setTranscript(previous => (previous + text).slice(-30000))
  useInput((value, key) => {
    if (key.ctrl && value === 'c') {
      if (busy) {
        controller.current?.abort()
      }
      else {
        exit()
      }
      return
    }
    if (key.escape && busy) {
      controller.current?.abort()
    }
    if (pending && ['y', 'n'].includes(value.toLowerCase())) {
      answer.current(value.toLowerCase() === 'y')
      setPending(undefined)
    }
  })
  const submit = async (prompt: string) => {
    if (!prompt.trim() || busy) {
      return
    }
    if (prompt.trim() === '/exit') {
      exit()
      return
    }
    setInput('')
    setBusy(true)
    append(`\nYou › ${prompt}\n\n`)
    const abort = new AbortController()
    controller.current = abort
    const approve: Approver = request =>
      new Promise((resolve) => {
        setPending(request)
        const stop = () => {
          setPending(undefined)
          resolve(false)
        }
        abort.signal.addEventListener('abort', stop, { once: true })
        answer.current = (value) => {
          abort.signal.removeEventListener('abort', stop)
          resolve(value)
        }
      })
    try {
      const result = await runInteractiveTask(
        runner,
        prompt,
        session,
        abort.signal,
        (event) => {
          append(eventText(event, 'interactive'))
          if (event.type === 'run.started') {
            setSession(event.sessionId)
          }
        },
        approve,
      )
      setSession(result.sessionId)
      if (result.status !== 'completed') {
        append(`${result.text}\n`)
      }
    }
    catch (error) {
      append(
        `Error: ${error instanceof Error ? error.message : String(error)}\n`,
      )
    }
    finally {
      setBusy(false)
      setPending(undefined)
    }
  }
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={2}>
        <Text bold color="cyan">
          WEAPP AGENT
        </Text>
        <Text dimColor>
          {session ? `session ${session}` : 'mini-program development'}
        </Text>
      </Box>
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        flexDirection="column"
      >
        <Text>{transcript}</Text>
      </Box>
      {pending
        ? (
            <Box flexDirection="column">
              <Text color="yellow">
                Approval ·
                {pending.kind}
              </Text>
              <Text>{pending.summary}</Text>
              <Text>Allow this exact operation? [y/n]</Text>
            </Box>
          )
        : busy
          ? (
              <Text color="cyan">Working… Esc to cancel</Text>
            )
          : (
              <Box>
                <Text color="cyan">› </Text>
                <TextInput value={input} onChange={setInput} onSubmit={submit} />
              </Box>
            )}
    </Box>
  )
}
export async function interactive(
  runner: InteractiveRunner,
  initialSession?: string,
): Promise<void> {
  const instance = render(
    <App runner={runner} initialSession={initialSession} />,
    { exitOnCtrlC: false },
  )
  await instance.waitUntilExit()
}
