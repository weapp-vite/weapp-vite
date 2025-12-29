import { computed, defineComponent, onShow, ref, watch } from 'wevu'

defineComponent({
  // Provide method stubs so WeChat devtools finds handlers on Page instance early
  // Runtime will bridge these to setup-returned handlers.
  methods: {
    increment() {},
    decrement() {},
    resetCounter() {},
    onNicknameInput(_e: WechatMiniprogram.Input) {},
    onMessageInput(_e: WechatMiniprogram.Input) {},
    onDraftInput(_e: WechatMiniprogram.Input) {},
    addTodo() {},
    removeTodo(_e: WechatMiniprogram.TouchEvent) {},
    clearTodos() {},
    openLifecycle() {},
    openLifecycleHooks() {},
    openStore() {},
    openProvider() {},
    openEffects() {},
    openVueIndex() {},
    openCommunicate() {},
    openSlot() {},
    openShare() {},
    openPerfChunk() {},
    openInjectSymbol() {},
    openPageCompLifecycle() {},
    openBench() {},
  },
  setup() {
    const count = ref(1)
    const nickname = ref('weapp-vite')
    const message = ref('欢迎使用 wevu runtime 示例')
    const draftTodo = ref('')
    const todos = ref<string[]>([])
    const logMessages = ref<string[]>([])

    const doubled = computed(() => count.value * 2)
    const greeting = computed(() => {
      const name = nickname.value.trim() || '朋友'
      const text = message.value.trim() || '欢迎体验运行时示例'
      return `${name}，${text}`
    })
    const todoSummary = computed(() =>
      todos.value.length ? `共有 ${todos.value.length} 个待办` : '暂无待办',
    )

    function appendLog(message: string) {
      logMessages.value = [...logMessages.value, message]
    }
    function increment() {
      count.value += 1
    }
    function decrement() {
      if (count.value > 0) {
        count.value -= 1
      }
    }
    function resetCounter() {
      if (count.value !== 0) {
        count.value = 0
        appendLog('计数器已重置')
      }
    }
    function addTodoFromDraft() {
      const value = draftTodo.value.trim()
      if (!value) {
        return false
      }
      todos.value = [...todos.value, value]
      draftTodo.value = ''
      appendLog(`新增待办：第 ${todos.value.length} 项`)
      return true
    }
    function removeTodo(index: number) {
      if (index < 0 || index >= todos.value.length) {
        return false
      }
      todos.value = todos.value.filter((_, i) => i !== index)
      appendLog(`删除待办：索引 ${index}`)
      return true
    }
    function clearTodos() {
      if (!todos.value.length) {
        return false
      }
      todos.value = []
      appendLog('已清空所有待办')
      return true
    }

    // template handlers
    function onNicknameInput(event: WechatMiniprogram.Input) {
      nickname.value = event.detail.value
    }
    function onMessageInput(event: WechatMiniprogram.Input) {
      message.value = event.detail.value
    }
    function onDraftInput(event: WechatMiniprogram.Input) {
      draftTodo.value = event.detail.value
    }
    function addTodo() {
      addTodoFromDraft()
    }
    function incrementClick() {
      increment()
    }
    function decrementClick() {
      decrement()
    }
    function resetCounterClick() {
      resetCounter()
    }
    function removeTodoClick(event: WechatMiniprogram.TouchEvent) {
      const datasetIndex = (event.currentTarget as any).dataset.index
      const index = typeof datasetIndex === 'number'
        ? datasetIndex
        : Number(datasetIndex ?? -1)
      if (!Number.isNaN(index) && index >= 0) {
        removeTodo(index)
      }
    }
    function clearTodosClick() {
      clearTodos()
    }

    onShow(() => appendLog('wevu runtime 已挂载到页面'))

    watch(count, (value, oldValue) => {
      if (value !== oldValue) {
        appendLog(`计数器：${oldValue} → ${value}`)
      }
    })

    watch(nickname, (value, oldValue) => {
      if (value !== oldValue) {
        appendLog(`昵称更新为：${value || '未设置'}`)
      }
    }, { immediate: true })

    return {
      // state (auto-unwrapped in template)
      count,
      nickname,
      message,
      draftTodo,
      todos,
      logMessages,
      // computed
      doubled,
      greeting,
      todoSummary,
      // methods used by template
      increment: incrementClick,
      decrement: decrementClick,
      resetCounter: resetCounterClick,
      onNicknameInput,
      onMessageInput,
      onDraftInput,
      addTodo,
      removeTodo: removeTodoClick,
      clearTodos: clearTodosClick,
      openLifecycle() {
        wx.navigateTo({ url: '/pages/lifecycle/index' })
      },
      openLifecycleHooks() {
        wx.navigateTo({ url: '/pages/wevu-hooks/index' })
      },
      openStore() {
        wx.navigateTo({ url: '/pages/store/index' })
      },
      openProvider() {
        wx.navigateTo({ url: '/pages/provider/index' })
      },
      openEffects() {
        wx.navigateTo({ url: '/pages/effects/index' })
      },
      openVueIndex() {
        wx.navigateTo({ url: '/pages/vue-index/index' })
      },
      openCommunicate() {
        wx.navigateTo({ url: '/pages/communicate/index' })
      },
      openSlot() {
        wx.navigateTo({ url: '/pages/slot/index' })
      },
      openShare() {
        wx.navigateTo({ url: '/pages/share/index' })
      },
      openPerfChunk() {
        wx.navigateTo({ url: '/subpackages/perf/pages/chunk/index' })
      },
      openInjectSymbol() {
        wx.navigateTo({ url: '/pages/inject-symbol/index' })
      },
      openPageCompLifecycle() {
        wx.navigateTo({ url: '/pages/page-comp-lifecycle/index' })
      },
      openBench() {
        wx.navigateTo({ url: '/pages/bench/index' })
      },
    }
  },
})
