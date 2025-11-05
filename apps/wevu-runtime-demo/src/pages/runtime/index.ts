import { defineComponent } from 'wevu'
import type {
  ComponentPublicInstance,
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
  RuntimeInstance,
} from 'wevu'

interface RuntimeState {
  count: number
  nickname: string
  message: string
  draftTodo: string
  todos: string[]
  logMessages: string[]
}

type RuntimeMethodDefs = {
  increment(this: RuntimeContext): void
  decrement(this: RuntimeContext): void
  resetCounter(this: RuntimeContext): void
  addTodoFromDraft(this: RuntimeContext): boolean
  removeTodo(this: RuntimeContext, index: number): boolean
  clearTodos(this: RuntimeContext): boolean
  appendLog(this: RuntimeContext, message: string): void
}

type RuntimeComputedDefs = {
  doubled(this: RuntimeContext): number
  greeting(this: RuntimeContext): string
  todoSummary(this: RuntimeContext): string
}

type RuntimeContext = ComponentPublicInstance<RuntimeState, RuntimeComputedDefs, RuntimeMethodDefs>
type MountedRuntime = RuntimeInstance<RuntimeState, RuntimeComputedDefs, RuntimeMethodDefs>

type RuntimePageInstance = WechatMiniprogram.Page.Instance<WechatMiniprogram.IAnyObject, WechatMiniprogram.Page.CustomOption> & {
  $wevu?: MountedRuntime
}

const pageOptions = {
  type: 'page',
  data: () => ({
    count: 1,
    nickname: 'weapp-vite',
    message: '欢迎使用 wevu runtime 示例',
    draftTodo: '',
    todos: [],
    logMessages: [],
  }),
  computed: {
    doubled(this: RuntimeContext) {
      return this.count * 2
    },
    greeting(this: RuntimeContext) {
      const name = this.nickname.trim() || '朋友'
      const text = this.message.trim() || '欢迎体验运行时示例'
      return `${name}，${text}`
    },
    todoSummary(this: RuntimeContext) {
      return this.todos.length ? `共有 ${this.todos.length} 个待办` : '暂无待办'
    },
  } satisfies ComputedDefinitions,
  methods: {
    increment(this: RuntimeContext) {
      this.count += 1
    },
    decrement(this: RuntimeContext) {
      if (this.count > 0) {
        this.count -= 1
      }
    },
    resetCounter(this: RuntimeContext) {
      if (this.count !== 0) {
        this.count = 0
        this.appendLog('计数器已重置')
      }
    },
    addTodoFromDraft(this: RuntimeContext) {
      const value = this.draftTodo.trim()
      if (!value) {
        return false
      }
      this.todos = [...this.todos, value]
      this.draftTodo = ''
      this.appendLog(`新增待办：第 ${this.todos.length} 项`)
      return true
    },
    removeTodo(this: RuntimeContext, index: number) {
      if (index < 0 || index >= this.todos.length) {
        return false
      }
      this.todos = this.todos.filter((_, idx) => idx !== index)
      this.appendLog(`删除待办：索引 ${index}`)
      return true
    },
    clearTodos(this: RuntimeContext) {
      if (!this.todos.length) {
        return false
      }
      this.todos = []
      this.appendLog('已清空所有待办')
      return true
    },
    appendLog(this: RuntimeContext, message: string) {
      this.logMessages = [...this.logMessages, message]
    },
  } satisfies MethodDefinitions,
  setup({ runtime, watch }) {
    runtime.methods.appendLog('wevu runtime 已挂载到页面')

    watch(
      () => runtime.proxy.count,
      (value, oldValue) => {
        if (value !== oldValue) {
          runtime.methods.appendLog(`计数器：${oldValue} → ${value}`)
        }
      },
    )

    watch(
      () => runtime.proxy.nickname,
      (value, oldValue) => {
        if (value !== oldValue) {
          runtime.methods.appendLog(`昵称更新为：${value || '未设置'}`)
        }
      },
      { immediate: true },
    )
  },
  increment(this: RuntimePageInstance) {
    this.$wevu?.methods.increment()
  },
  decrement(this: RuntimePageInstance) {
    this.$wevu?.methods.decrement()
  },
  resetCounter(this: RuntimePageInstance) {
    this.$wevu?.methods.resetCounter()
  },
  onNicknameInput(this: RuntimePageInstance, event: WechatMiniprogram.Input) {
    this.$wevu?.bindModel('nickname').update(event.detail.value)
  },
  onMessageInput(this: RuntimePageInstance, event: WechatMiniprogram.Input) {
    this.$wevu?.bindModel('message').update(event.detail.value)
  },
  onDraftInput(this: RuntimePageInstance, event: WechatMiniprogram.Input) {
    this.$wevu?.bindModel('draftTodo').update(event.detail.value)
  },
  addTodo(this: RuntimePageInstance) {
    const runtime = this.$wevu
    if (!runtime) {
      return
    }
    runtime.methods.addTodoFromDraft()
  },
  removeTodo(this: RuntimePageInstance, event: WechatMiniprogram.TouchEvent) {
    const runtime = this.$wevu
    if (!runtime) {
      return
    }
    const datasetIndex = event.currentTarget.dataset.index
    const index = typeof datasetIndex === 'number'
      ? datasetIndex
      : Number(datasetIndex ?? -1)
    if (Number.isNaN(index) || index < 0) {
      return
    }
    runtime.methods.removeTodo(index)
  },
  clearTodos(this: RuntimePageInstance) {
    const runtime = this.$wevu
    if (!runtime) {
      return
    }
    runtime.methods.clearTodos()
  },
} satisfies DefineComponentOptions<RuntimeState, RuntimeComputedDefs, RuntimeMethodDefs>

defineComponent<RuntimeState, RuntimeComputedDefs, RuntimeMethodDefs>(pageOptions)
