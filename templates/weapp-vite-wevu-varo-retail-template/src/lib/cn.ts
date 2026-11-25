import type { ClassValue } from 'clsx'
import { twMerge } from '@weapp-tailwindcss/merge'
import { clsx } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export type { ClassValue }
