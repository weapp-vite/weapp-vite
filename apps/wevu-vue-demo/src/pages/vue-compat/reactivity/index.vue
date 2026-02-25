<script setup lang="ts">
import {
  computed,
  customRef,
  effectScope,
  markRaw,
  onScopeDispose,
  reactive,
  ref,
  shallowReactive,
  toRef,
  toRefs,
  watch,
  watchEffect,
} from 'wevu'

definePageJson({
  navigationBarTitleText: '响应式对照',
})

function appendLog(target: { value: string[] }, message: string, limit = 8) {
  const time = new Date().toISOString().slice(11, 19)
  target.value = [`${time} ${message}`, ...target.value].slice(0, limit)
}

// Case A: ref() 可选参数 + writable computed
const optionalMessage = ref<string>()
const basePrice = ref(100)
const taxRate = ref(0.13)
const finalPrice = computed({
  get() {
    return Number((basePrice.value * (1 + taxRate.value)).toFixed(2))
  },
  set(value) {
    basePrice.value = Number((value / (1 + taxRate.value)).toFixed(2))
  },
})

function fillOptionalMessage() {
  optionalMessage.value = `optional-${Date.now() % 100000}`
}

function increaseFinalPrice() {
  finalPrice.value = Number((finalPrice.value + 10).toFixed(2))
}

function switchTaxRate() {
  taxRate.value = taxRate.value === 0.13 ? 0.06 : 0.13
}

// Case B: 多源 watch + onCleanup 处理竞态
const searchQuery = ref('reactivity')
const searchPage = ref(1)
const remoteState = ref('idle')
const watchRaceLogs = ref<string[]>([])
let requestId = 0

watch(
  [searchQuery, searchPage] as const,
  ([query, page], oldValues, onCleanup) => {
    const currentId = ++requestId
    const prev = oldValues ? `${oldValues[0]}@${oldValues[1]}` : '(init)'
    appendLog(watchRaceLogs, `request#${currentId}: ${prev} -> ${query}@${page}`)
    remoteState.value = `pending #${currentId}`

    let canceled = false
    const timer = setTimeout(() => {
      if (canceled) {
        appendLog(watchRaceLogs, `request#${currentId} canceled`)
        return
      }
      remoteState.value = `resolved #${currentId}: ${query}-${page}`
      appendLog(watchRaceLogs, `request#${currentId} resolved`)
    }, 220 + query.length * 40 + page * 60)

    onCleanup(() => {
      canceled = true
      clearTimeout(timer)
      appendLog(watchRaceLogs, `cleanup request#${currentId}`)
    })
  },
  { immediate: true },
)

function rotateQuery() {
  const next = ['reactivity', 'watch-cleanup', 'effect-scope', 'custom-ref']
  const index = next.indexOf(searchQuery.value)
  searchQuery.value = next[(index + 1) % next.length]
}

function nextPage() {
  searchPage.value += 1
}

function burstUpdates() {
  searchQuery.value = `burst-${(requestId % 4) + 1}`
  searchPage.value += 1
  searchPage.value += 1
}

// Case C: watchEffect pause/resume/stop
const effectSeed = ref(0)
const effectRuns = ref(0)
const effectCleanups = ref(0)
const effectStatus = ref<'running' | 'paused' | 'stopped'>('running')
const effectLogs = ref<string[]>([])

const effectHandle = watchEffect((onCleanup) => {
  effectRuns.value += 1
  const snapshot = effectSeed.value
  appendLog(effectLogs, `run snapshot=${snapshot}`)
  onCleanup(() => {
    effectCleanups.value += 1
    appendLog(effectLogs, `cleanup snapshot=${snapshot}`)
  })
})

function bumpEffectSeed() {
  effectSeed.value += 1
}

function pauseEffect() {
  if (effectStatus.value !== 'running') {
    return
  }
  effectHandle.pause()
  effectStatus.value = 'paused'
  appendLog(effectLogs, 'pause()')
}

function resumeEffect() {
  if (effectStatus.value !== 'paused') {
    return
  }
  effectHandle.resume()
  effectStatus.value = 'running'
  appendLog(effectLogs, 'resume()')
}

function stopEffect() {
  if (effectStatus.value === 'stopped') {
    return
  }
  effectHandle.stop()
  effectStatus.value = 'stopped'
  appendLog(effectLogs, 'stop()')
}

// Case D: effectScope + onScopeDispose 生命周期隔离
const scopedSource = ref(0)
const scopedMirror = ref(-1)
const scopedDisposeCount = ref(0)
const scopedStatus = ref<'inactive' | 'active'>('inactive')
const scopeLogs = ref<string[]>([])
let activeScope: ReturnType<typeof effectScope> | null = null

function mountScope() {
  if (activeScope?.active) {
    return
  }

  const scope = effectScope()
  scope.run(() => {
    watch(
      scopedSource,
      (value, oldValue) => {
        scopedMirror.value = value
        appendLog(scopeLogs, `scope watch: ${String(oldValue)} -> ${value}`)
      },
      { immediate: true },
    )
    onScopeDispose(() => {
      scopedDisposeCount.value += 1
      appendLog(scopeLogs, `scope disposed #${scopedDisposeCount.value}`)
    })
  })

  activeScope = scope
  scopedStatus.value = 'active'
  appendLog(scopeLogs, 'scope mounted')
}

function unmountScope() {
  if (!activeScope) {
    return
  }
  activeScope.stop()
  activeScope = null
  scopedStatus.value = 'inactive'
}

function bumpScopedSource() {
  scopedSource.value += 1
}

// Case E: customRef 去抖提交
function useDebouncedRef(initialValue: string, delay = 360) {
  let value = initialValue
  let timer: ReturnType<typeof setTimeout> | undefined
  return customRef<string>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(nextValue) {
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        value = nextValue
        trigger()
      }, delay)
    },
  }), initialValue)
}

const inputKeyword = ref('wevu')
const debouncedKeyword = useDebouncedRef('wevu')
const debounceLogs = ref<string[]>([])

watch(inputKeyword, (value) => {
  debouncedKeyword.value = value
})

watch(debouncedKeyword, (value, oldValue) => {
  appendLog(debounceLogs, `commit: ${String(oldValue)} -> ${value}`)
})

function applySuggestion() {
  inputKeyword.value = `vue-${Date.now() % 1000}`
}

function appendSuffix() {
  inputKeyword.value = `${inputKeyword.value}-x`
}

// Case F: shallowReactive 顶层追踪 vs 嵌套属性
const shallowState = shallowReactive({
  nested: { count: 0 },
  topLevel: 0,
})
const shallowLogs = ref<string[]>([])

watch(
  () => shallowState.nested.count,
  (value, oldValue) => {
    appendLog(shallowLogs, `nested.count: ${String(oldValue)} -> ${value}`)
  },
  { immediate: true },
)

function mutateNestedOnly() {
  shallowState.nested.count += 1
}

function replaceNested() {
  shallowState.nested = { count: shallowState.nested.count + 1 }
}

function bumpTopLevel() {
  shallowState.topLevel += 1
}

// Case G: markRaw 非响应式负载
const rawContainer = reactive({
  payload: markRaw({ hits: 0, label: 'raw-a' }),
})
const rawLogs = ref<string[]>([])

watch(
  () => rawContainer.payload.hits,
  (value, oldValue) => {
    appendLog(rawLogs, `payload.hits: ${String(oldValue)} -> ${value}`)
  },
  { immediate: true },
)

function mutateRawPayload() {
  rawContainer.payload.hits += 1
}

function replaceRawPayload() {
  rawContainer.payload = markRaw({
    hits: rawContainer.payload.hits + 1,
    label: `raw-${Date.now() % 100}`,
  })
}

// Case H: toRef / toRefs 双向桥接
const profile = reactive<{
  name: string
  visits: number
  mode?: string
}>({
  name: 'alice',
  visits: 0,
})

const profileName = toRef(profile, 'name')
const profileMode = toRef(profile, 'mode', 'guest')
const { visits: profileVisits } = toRefs(profile)
const bridgeLogs = ref<string[]>([])

watch(
  [profileName, profileVisits, profileMode] as const,
  ([name, visits, mode], oldValues) => {
    const prevName = oldValues?.[0]
    const prevVisits = oldValues?.[1]
    const prevMode = oldValues?.[2]
    appendLog(
      bridgeLogs,
      `name ${String(prevName)} -> ${name}, visits ${String(prevVisits)} -> ${visits}, mode ${String(prevMode)} -> ${String(mode)}`,
    )
  },
  { immediate: true },
)

function mutateByObject() {
  profile.name = `obj-${profile.visits + 1}`
  profile.visits += 1
}

function mutateByRefs() {
  profileName.value = `ref-${Date.now() % 1000}`
  profileVisits.value += 1
}

function toggleMode() {
  profileMode.value = profileMode.value === 'guest' ? 'admin' : 'guest'
}

mountScope()
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="title">
        响应式能力对照
      </text>
      <text class="subtitle">
        覆盖高复杂度响应式组合场景，验证 wevu 与 Vue 3 行为一致性。
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        Case A: ref() 无参 + writable computed
      </text>
      <text class="section-desc">
        行为说明：`ref()` 支持无参调用，`computed({ get, set })` 允许派生值回写源状态。
      </text>
      <text class="section-desc">
        预期结果：设置 `finalPrice` 会反推 `basePrice`；无参 `optionalMessage` 初始是 `undefined`。
      </text>
      <text class="card-meta">
        optionalMessage: {{ optionalMessage || '(undefined)' }}
      </text>
      <text class="card-meta">
        basePrice: {{ basePrice }} / taxRate: {{ taxRate }} / finalPrice: {{ finalPrice }}
      </text>
      <view class="row">
        <button class="btn light" @tap="fillOptionalMessage">
          写入 optional ref
        </button>
        <button class="btn" @tap="increaseFinalPrice">
          finalPrice + 10
        </button>
        <button class="btn secondary" @tap="switchTaxRate">
          切换税率
        </button>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        Case B: 多源 watch + onCleanup
      </text>
      <text class="section-desc">
        行为说明：对 `[query, page]` 进行联合侦听，每次变更发起异步任务并在 `onCleanup` 中取消旧任务。
      </text>
      <text class="section-desc">
        预期结果：快速连续变更时只保留最后一次请求结果，日志中会出现 cleanup/canceled 记录。
      </text>
      <text class="card-meta">
        query: {{ searchQuery }} / page: {{ searchPage }} / remoteState: {{ remoteState }}
      </text>
      <view class="row">
        <button class="btn light" @tap="rotateQuery">
          切换 query
        </button>
        <button class="btn" @tap="nextPage">
          page + 1
        </button>
        <button class="btn secondary" @tap="burstUpdates">
          连续突发更新
        </button>
      </view>
      <view class="card-list">
        <view v-for="(line, index) in watchRaceLogs" :key="`watch-race-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        Case C: watchEffect 控制句柄
      </text>
      <text class="section-desc">
        行为说明：`watchEffect` 返回 `pause/resume/stop` 句柄，cleanup 在每轮重跑和 stop 时执行。
      </text>
      <text class="section-desc">
        预期结果：pause 后源状态变化不触发 run；resume 后继续；stop 后彻底停止。
      </text>
      <text class="card-meta">
        effectSeed: {{ effectSeed }} / status: {{ effectStatus }}
      </text>
      <text class="card-meta">
        runs: {{ effectRuns }} / cleanups: {{ effectCleanups }}
      </text>
      <view class="row">
        <button class="btn" @tap="bumpEffectSeed">
          seed + 1
        </button>
        <button class="btn light" @tap="pauseEffect">
          pause
        </button>
        <button class="btn light" @tap="resumeEffect">
          resume
        </button>
        <button class="btn secondary" @tap="stopEffect">
          stop
        </button>
      </view>
      <view class="card-list">
        <view v-for="(line, index) in effectLogs" :key="`effect-log-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        Case D: effectScope + onScopeDispose
      </text>
      <text class="section-desc">
        行为说明：在 `effectScope.run` 内注册 watch 和 `onScopeDispose`，通过 stop 一次性释放作用域内副作用。
      </text>
      <text class="section-desc">
        预期结果：作用域 inactive 时，`scopedSource` 变化不会再同步到 `scopedMirror`。
      </text>
      <text class="card-meta">
        scopeStatus: {{ scopedStatus }} / scopedSource: {{ scopedSource }} / scopedMirror: {{ scopedMirror }}
      </text>
      <text class="card-meta">
        disposeCount: {{ scopedDisposeCount }}
      </text>
      <view class="row">
        <button class="btn" @tap="bumpScopedSource">
          scopedSource + 1
        </button>
        <button class="btn light" @tap="mountScope">
          mount scope
        </button>
        <button class="btn secondary" @tap="unmountScope">
          unmount scope
        </button>
      </view>
      <view class="card-list">
        <view v-for="(line, index) in scopeLogs" :key="`scope-log-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        Case E: customRef 去抖更新
      </text>
      <text class="section-desc">
        行为说明：输入先更新 `inputKeyword`，再通过 customRef 延时提交到 `debouncedKeyword`。
      </text>
      <text class="section-desc">
        预期结果：快速输入期间 `debouncedKeyword` 不立即变化，停止输入后统一提交一次。
      </text>
      <text class="card-meta">
        inputKeyword: {{ inputKeyword }} / debouncedKeyword: {{ debouncedKeyword }}
      </text>
      <input v-model="inputKeyword" class="input" placeholder="快速输入观察去抖提交">
      <view class="row">
        <button class="btn light" @tap="applySuggestion">
          使用建议词
        </button>
        <button class="btn secondary" @tap="appendSuffix">
          追加后缀
        </button>
      </view>
      <view class="card-list">
        <view v-for="(line, index) in debounceLogs" :key="`debounce-log-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        Case F: shallowReactive 顶层/嵌套差异
      </text>
      <text class="section-desc">
        行为说明：侦听 `shallowState.nested.count`，分别执行嵌套字段自增和整个 nested 对象替换。
      </text>
      <text class="section-desc">
        预期结果：仅改 `nested.count` 不触发 watch；替换 `nested` 会触发 watch。
      </text>
      <text class="card-meta">
        nested.count: {{ shallowState.nested.count }} / topLevel: {{ shallowState.topLevel }}
      </text>
      <view class="row">
        <button class="btn light" @tap="mutateNestedOnly">
          nested.count + 1
        </button>
        <button class="btn" @tap="replaceNested">
          replace nested
        </button>
        <button class="btn secondary" @tap="bumpTopLevel">
          topLevel + 1
        </button>
      </view>
      <view class="card-list">
        <view v-for="(line, index) in shallowLogs" :key="`shallow-log-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        Case G: markRaw 负载对象
      </text>
      <text class="section-desc">
        行为说明：`payload` 被 markRaw 后不进行深层响应式转换，watch 读取 `payload.hits`。
      </text>
      <text class="section-desc">
        预期结果：直接 `hits++` 不触发 watch；替换整个 `payload` 才触发。
      </text>
      <text class="card-meta">
        payload.hits: {{ rawContainer.payload.hits }} / payload.label: {{ rawContainer.payload.label }}
      </text>
      <view class="row">
        <button class="btn light" @tap="mutateRawPayload">
          payload.hits + 1
        </button>
        <button class="btn secondary" @tap="replaceRawPayload">
          replace payload
        </button>
      </view>
      <view class="card-list">
        <view v-for="(line, index) in rawLogs" :key="`raw-log-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        Case H: toRef / toRefs 双向桥接
      </text>
      <text class="section-desc">
        行为说明：同一份 `profile` 同时通过对象写入和 ref 写入，校验值双向同步。
      </text>
      <text class="section-desc">
        预期结果：修改 `profileName/profileVisits/profileMode` 会实时反映到 `profile`，反之亦然。
      </text>
      <text class="card-meta">
        profile.name: {{ profile.name }} / visits: {{ profile.visits }} / mode: {{ profile.mode }}
      </text>
      <view class="row">
        <button class="btn light" @tap="mutateByObject">
          通过对象写入
        </button>
        <button class="btn" @tap="mutateByRefs">
          通过 ref 写入
        </button>
        <button class="btn secondary" @tap="toggleMode">
          切换 mode
        </button>
      </view>
      <view class="card-list">
        <view v-for="(line, index) in bridgeLogs" :key="`bridge-log-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
@import '../shared.css';
</style>
