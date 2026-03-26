import { twMerge } from 'tailwind-merge'

export function cn(...values: Array<string | false | null | undefined>) {
  return twMerge(values.filter(Boolean).join(' '))
}
