import dayjs from 'dayjs'

export function buildSharedMessage(origin: string) {
  const formatted = dayjs().format('YYYY-MM-DD HH:mm:ss')
  return `[shared:${origin}] ${formatted}`
}
