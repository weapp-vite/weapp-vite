/**
 * 说明：Vue 3 风格的 props 声明（用于类型提示）
 */
export function defineProps<T extends Record<string, any>>(props: T): T {
  return props
}

/**
 * 说明：Vue 3 风格的 emits 声明（用于类型提示）
 */
export function defineEmits<T extends Record<string, any> | string[]>(emits: T): T {
  return emits
}
