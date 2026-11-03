const expressionWord = 1
const controlWord = 2
const blockWord = 4
const declarationPrefix = 8
const lineBreakWord = 16
const exportWord = 32
const typeObjectWord = 64
const functionWord = 128
const classWord = 256
const caseWord = 512
const defaultWord = 1024
const wordRoles = new Map<string, number>([
  ['return', expressionWord | lineBreakWord],
  ['throw', expressionWord],
  ['case', expressionWord | caseWord],
  ['delete', expressionWord],
  ['void', expressionWord],
  ['typeof', expressionWord],
  ['new', expressionWord],
  ['in', expressionWord],
  ['instanceof', expressionWord],
  ['yield', expressionWord | lineBreakWord],
  ['await', expressionWord],
  ['else', expressionWord | blockWord],
  ['do', expressionWord | blockWord],
  ['if', controlWord],
  ['while', controlWord],
  ['for', controlWord],
  ['with', controlWord],
  ['switch', controlWord],
  ['catch', controlWord],
  ['try', blockWord],
  ['finally', blockWord],
  ['async', declarationPrefix],
  ['export', declarationPrefix | exportWord],
  ['default', declarationPrefix | defaultWord],
  ['extends', typeObjectWord],
  ['keyof', typeObjectWord],
  ['readonly', typeObjectWord],
  ['is', typeObjectWord],
  ['function', functionWord],
  ['class', classWord],
])
const lineBreakPattern = /[\n\r\u2028\u2029]/
const expressionAfter = 0x100
const statementBody = 0x200
const functionParameters = 0x400
const bracketMask = 0xFF

interface ConstructHeader {
  kind: 'function' | 'class'
  phase: 'head' | 'parameters' | 'body'
  depth: number
  declaration: boolean
  angles: number
  typed: boolean
}

/** 保存有效 token 的词法目标，构造体正文按声明或表达式归属恢复斜杠判界。 */
export class TokenContext {
  operand = true
  private previousRoles = 0
  private previousCode: number
  private brackets?: number[]
  private readonly rootStatement: boolean
  private statement: boolean
  private label = false
  private arrowBody = false
  private headers?: ConstructHeader[]
  private questions?: number[]
  private cases?: number[]

  constructor(expression = false) {
    this.previousCode = expression ? -1 : 0
    this.rootStatement = this.statement = !expression
  }

  get depth() {
    return this.brackets?.length ?? 0
  }

  get bracket() {
    const frame = this.brackets?.[this.brackets.length - 1]
    return frame === undefined ? undefined : frame & bracketMask
  }

  word(source: string, start: number, end: number) {
    if (this.previousCode === 46) {
      this.value()
      return
    }
    const roles = wordRoles.get(source.slice(start, end)) ?? 0
    if (roles) {
      this.keyword(roles)
      return
    }
    this.label = this.statement
    this.operand = this.statement = this.arrowBody = false
    this.previousRoles = 0
    this.previousCode = 1
  }

  private keyword(roles: number) {
    const startsStatement = this.statement
    const caseLabel = startsStatement && Boolean((roles & caseWord) || ((roles & defaultWord) && !(this.previousRoles & exportWord)))
    if (roles & (functionWord | classWord)) {
      ;(this.headers ??= []).push({ kind: roles & functionWord ? 'function' : 'class', phase: 'head', depth: this.depth, declaration: startsStatement, angles: 0, typed: false })
    }
    if (caseLabel) {
      ;(this.cases ??= []).push(this.depth)
    }
    this.label = startsStatement && !caseLabel && !(roles & (expressionWord | controlWord | blockWord | functionWord | classWord | exportWord | defaultWord))
    this.statement = Boolean((roles & blockWord) || (startsStatement && !caseLabel && (roles & declarationPrefix)))
    this.previousRoles = roles
    this.previousCode = 1
    this.arrowBody = false
    this.operand = Boolean(roles & expressionWord)
  }

  value(code = 1) {
    this.operand = false
    this.statement = this.label = this.arrowBody = false
    this.previousRoles = 0
    this.previousCode = code
  }

  increment(code: number) {
    this.statement = this.label = this.arrowBody = false
    this.previousRoles = 0
    this.previousCode = code
  }

  /** 换行只恢复可开始声明的位置，不改变跨行除法的表达式目标。 */
  lineBreak(source?: string, start?: number, end?: number) {
    if (this.operand && !(this.previousRoles & lineBreakWord)) {
      return
    }
    const frame = this.brackets?.[this.brackets.length - 1]
    const header = this.headers?.[this.headers.length - 1]
    if ((frame === undefined ? this.rootStatement : Boolean(frame & statementBody)) && header?.depth !== this.depth
      && (source === undefined || lineBreakPattern.test(source.slice(start, end)))) {
      this.statement = true
    }
  }

  /** 普通括号仍用数字帧；只有函数或类的头部需要保存跨 token 的正文归属。 */
  punctuation(code: number, next = 0) {
    let matched = true
    if (code === 46) {
      this.operand = this.statement = false
    }
    else if (code === 91) {
      ;(this.brackets ??= []).push(code)
      this.operand = true
      this.statement = false
    }
    else {
      matched = this.punctuationContext(code, next)
    }
    this.arrowBody = code === 62 && this.previousCode === 61
    this.label = false
    this.previousRoles = 0
    this.previousCode = code
    return matched
  }

  private punctuationContext(code: number, next: number) {
    let matched = true
    const header = this.headers?.[this.headers.length - 1]
    const currentHeader = header && header.depth === this.depth ? header : undefined
    if (code === 40) {
      if (currentHeader?.kind === 'function' && currentHeader.phase === 'head' && !currentHeader.angles) {
        currentHeader.phase = 'parameters'
        ;(this.brackets ??= []).push(code | functionParameters)
      }
      else {
        ;(this.brackets ??= []).push(code | (this.previousRoles & controlWord ? expressionAfter : 0))
      }
      this.operand = true
      this.statement = false
    }
    else if (code === 123) {
      const typeObject = currentHeader && (currentHeader.angles > 0 || (currentHeader.phase === 'body' && currentHeader.typed
        && ([58, 38, 124, 63, 61, 62].includes(this.previousCode) || (this.previousRoles & typeObjectWord))))
      if (currentHeader && !typeObject && !currentHeader.angles
        && (currentHeader.kind === 'class' || currentHeader.phase === 'body')) {
        this.headers!.pop()
        ;(this.brackets ??= []).push(code | statementBody | (currentHeader.declaration ? expressionAfter : 0))
        this.statement = true
      }
      else if (this.arrowBody && !typeObject) {
        ;(this.brackets ??= []).push(code | statementBody)
        this.statement = true
      }
      else {
        const object = typeObject || (this.operand && !this.statement)
        ;(this.brackets ??= []).push(code | (object ? 0 : expressionAfter | statementBody))
        this.statement = !object
      }
      this.operand = true
    }
    else if (code === 41 || code === 93 || code === 125) {
      const expected = code === 41 ? 40 : code === 93 ? 91 : 123
      const frame = this.brackets?.pop()
      matched = frame !== undefined && (frame & bracketMask) === expected
      if (frame !== undefined && (frame & functionParameters)) {
        const parameters = this.headers?.[this.headers.length - 1]
        if (parameters?.kind === 'function' && parameters.phase === 'parameters' && parameters.depth === this.depth) {
          parameters.phase = 'body'
        }
        this.operand = this.statement = false
      }
      else {
        this.operand = frame === undefined ? code === 125 : Boolean(frame & expressionAfter)
        this.statement = this.operand
      }
    }
    else {
      if (currentHeader && currentHeader.phase !== 'parameters') {
        if (code === 60) {
          currentHeader.angles++
        }
        else if (code === 62 && this.previousCode !== 61 && currentHeader.angles) {
          currentHeader.angles--
        }
        else if (code === 58 && currentHeader.phase === 'body') {
          currentHeader.typed = true
        }
        else if (!currentHeader.angles && currentHeader.phase === 'head' && (code === 58 || code === 61 || code === 44 || code === 59)) {
          // 对象/类中名为 function 或 class 的属性不建立构造体正文。
          this.headers!.pop()
        }
      }
      this.operand = code !== 46
      if (code === 59) {
        const frame = this.brackets?.[this.brackets.length - 1]
        this.statement = frame === undefined ? this.rootStatement : Boolean(frame & statementBody)
      }
      else if (code === 58) {
        if (this.questions?.[this.questions.length - 1] === this.depth) {
          this.questions.pop()
          this.statement = false
        }
        else if (this.cases?.[this.cases.length - 1] === this.depth) {
          this.cases.pop()
          this.statement = true
        }
        else {
          this.statement = this.label
        }
      }
      else {
        this.statement = false
        if (code === 63 && next !== 46 && next !== 63 && this.previousCode !== 63) {
          ;(this.questions ??= []).push(this.depth)
        }
      }
    }
    return matched
  }
}
