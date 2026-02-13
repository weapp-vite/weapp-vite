function normalizeCanvasNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return value
}

function resolveCanvasById(canvasId: string) {
  if (typeof document === 'undefined') {
    return undefined
  }
  const runtimeDocument = document as Document & {
    querySelectorAll?: (selector: string) => ArrayLike<Element>
    body?: {
      querySelectorAll?: (selector: string) => ArrayLike<Element>
    }
  }
  const normalized = canvasId.trim()
  if (!normalized) {
    return undefined
  }
  const canvasList = runtimeDocument.querySelectorAll?.('canvas')
    ?? runtimeDocument.body?.querySelectorAll?.('canvas')
    ?? []
  for (const candidate of Array.from(canvasList)) {
    const canvas = candidate as HTMLCanvasElement
    if (!canvas) {
      continue
    }
    if ((canvas as { id?: string }).id === normalized) {
      return canvas
    }
    if (typeof canvas.getAttribute === 'function' && canvas.getAttribute('canvas-id') === normalized) {
      return canvas
    }
  }
  return undefined
}

function createCanvasCommandQueue(canvasId: string) {
  const commands: Array<(ctx: CanvasRenderingContext2D) => void> = []

  const pushCommand = (command: (ctx: CanvasRenderingContext2D) => void) => {
    commands.push(command)
  }

  const draw: CanvasContext['draw'] = (reserveOrCallback?: boolean | (() => void), callback?: () => void) => {
    const reserve = typeof reserveOrCallback === 'boolean' ? reserveOrCallback : false
    const done = typeof reserveOrCallback === 'function' ? reserveOrCallback : callback
    const canvas = resolveCanvasById(canvasId)
    const context = canvas?.getContext?.('2d') as CanvasRenderingContext2D | null | undefined
    if (!context) {
      commands.length = 0
      done?.()
      return
    }
    if (!reserve) {
      context.clearRect(0, 0, normalizeCanvasNumber(canvas?.width), normalizeCanvasNumber(canvas?.height))
    }
    for (const command of commands) {
      command(context)
    }
    commands.length = 0
    done?.()
  }

  const api: CanvasContext = {
    setFillStyle(color: string) {
      pushCommand((ctx) => {
        ctx.fillStyle = color
      })
    },
    setStrokeStyle(color: string) {
      pushCommand((ctx) => {
        ctx.strokeStyle = color
      })
    },
    setLineWidth(width: number) {
      pushCommand((ctx) => {
        ctx.lineWidth = normalizeCanvasNumber(width)
      })
    },
    setFontSize(size: number) {
      pushCommand((ctx) => {
        const normalized = Math.max(1, normalizeCanvasNumber(size))
        ctx.font = `${normalized}px sans-serif`
      })
    },
    fillRect(x: number, y: number, width: number, height: number) {
      pushCommand((ctx) => {
        ctx.fillRect(
          normalizeCanvasNumber(x),
          normalizeCanvasNumber(y),
          normalizeCanvasNumber(width),
          normalizeCanvasNumber(height),
        )
      })
    },
    strokeRect(x: number, y: number, width: number, height: number) {
      pushCommand((ctx) => {
        ctx.strokeRect(
          normalizeCanvasNumber(x),
          normalizeCanvasNumber(y),
          normalizeCanvasNumber(width),
          normalizeCanvasNumber(height),
        )
      })
    },
    clearRect(x: number, y: number, width: number, height: number) {
      pushCommand((ctx) => {
        ctx.clearRect(
          normalizeCanvasNumber(x),
          normalizeCanvasNumber(y),
          normalizeCanvasNumber(width),
          normalizeCanvasNumber(height),
        )
      })
    },
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      pushCommand((ctx) => {
        const normalizedText = String(text ?? '')
        const normalizedX = normalizeCanvasNumber(x)
        const normalizedY = normalizeCanvasNumber(y)
        if (typeof maxWidth === 'number' && Number.isFinite(maxWidth)) {
          ctx.fillText(normalizedText, normalizedX, normalizedY, normalizeCanvasNumber(maxWidth))
          return
        }
        ctx.fillText(normalizedText, normalizedX, normalizedY)
      })
    },
    beginPath() {
      pushCommand(ctx => ctx.beginPath())
    },
    closePath() {
      pushCommand(ctx => ctx.closePath())
    },
    moveTo(x: number, y: number) {
      pushCommand((ctx) => {
        ctx.moveTo(normalizeCanvasNumber(x), normalizeCanvasNumber(y))
      })
    },
    lineTo(x: number, y: number) {
      pushCommand((ctx) => {
        ctx.lineTo(normalizeCanvasNumber(x), normalizeCanvasNumber(y))
      })
    },
    stroke() {
      pushCommand(ctx => ctx.stroke())
    },
    draw,
  }
  return api
}

export function createCanvasContextBridge(canvasId: string) {
  return createCanvasCommandQueue(String(canvasId ?? ''))
}
