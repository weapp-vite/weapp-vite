export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function toToolResult(data: unknown, text?: string) {
  return {
    content: [{
      type: 'text' as const,
      text: text ?? formatJson(data),
    }],
    structuredContent: {
      result: data,
    },
  }
}

export function toToolError(error: unknown) {
  const message = normalizeErrorMessage(error)
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: message,
    }],
  }
}
