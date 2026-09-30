export function bounded(text: string, max = 40_000): string {
  return text.length > max
    ? `${text.slice(0, max)}\n[truncated: ${text.length - max} more characters]`
    : text
}
