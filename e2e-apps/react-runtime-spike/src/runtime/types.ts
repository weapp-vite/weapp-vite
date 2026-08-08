import type { ReactNode } from 'react'

export interface MiniProgramEventLike {
  currentTarget?: {
    dataset?: Record<string, unknown>
  }
  detail?: Record<string, unknown>
  target?: unknown
  type: string
}

export interface MiniProgramPageAdapter {
  setData: (payload: Record<string, unknown>, callback?: () => void) => void
}

export interface SerializedHostNode {
  cl?: string
  cn?: SerializedHostNode[]
  nn: string
  p?: Record<string, unknown>
  sid: string
  st?: string
  v?: string
}

export type HostProps = Record<string, unknown>

export interface MiniProgramHostProps {
  children?: ReactNode
  checked?: boolean
  class?: string
  className?: string
  disabled?: boolean
  hidden?: boolean
  id?: string
  onChange?: HostEventHandler
  onInput?: HostEventHandler
  onTap?: HostEventHandler
  onTapCapture?: HostEventHandler
  placeholder?: string
  style?: Record<string, string | number | null | undefined> | string
  type?: string
  value?: string | number
}

export type HostEventHandler = (event: {
  currentTarget: unknown
  detail: Record<string, unknown>
  nativeEvent: MiniProgramEventLike
  stopPropagation: () => void
  target: unknown
  type: string
}) => unknown
