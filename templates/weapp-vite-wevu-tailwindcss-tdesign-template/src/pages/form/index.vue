<script setup lang="ts">
import type { UploadFile } from 'tdesign-miniprogram/upload/type'
import type { ModelBindingOptions, ModelBindingPayload } from 'wevu'
import Toast from 'tdesign-miniprogram/toast/index'

import { computed, getCurrentInstance, reactive, ref, useBindModel, watch } from 'wevu'

import FormRow from '@/components/FormRow/index.vue'
import FormStep from '@/components/FormStep/index.vue'
import ResultCard from '@/components/ResultCard/index.vue'
import SectionTitle from '@/components/SectionTitle/index.vue'

definePageJson({
  navigationBarTitleText: '表单',
  backgroundColor: '#f6f7fb',
})

const mpContext = getCurrentInstance()
const bindModel = useBindModel()

function changeModel<T, ValueProp extends string = 'value', Formatted = T>(path: string, options?: ModelBindingOptions<T, 'change', ValueProp, Formatted>): ModelBindingPayload<T, 'change', ValueProp, Formatted> {
  return bindModel(path).model({ event: 'change', ...options })
}

const steps = [
  { key: 'basic', title: '基础信息', subtitle: '业务基本配置' },
  { key: 'strategy', title: '执行策略', subtitle: '预算与节奏' },
  { key: 'confirm', title: '确认提交', subtitle: '核对并提交' },
]

const currentStep = ref(0)
const submitted = ref(false)

const formState = reactive({
  name: '',
  owner: '',
  category: 'growth',
  urgent: false,
  budget: 30,
  pace: 'balanced',
  description: '',
  attachments: [] as UploadFile[],
})

const categories = [
  { value: 'growth', label: '增长' },
  { value: 'retention', label: '留存' },
  { value: 'brand', label: '品牌' },
]

const paceOptions = [
  { value: 'fast', label: '快速推进' },
  { value: 'balanced', label: '平衡' },
  { value: 'steady', label: '稳健' },
]

const riskLevel = computed(() => {
  if (formState.urgent && formState.budget > 60) {
    return '高风险'
  }
  if (formState.budget > 40) {
    return '中风险'
  }
  return '可控'
})

const canGoNext = computed(() => {
  if (currentStep.value === 0) {
    return !!formState.name && !!formState.owner
  }
  if (currentStep.value === 1) {
    return !!formState.description
  }
  return true
})

const summaryRows = computed(() => [
  { label: '项目名称', value: formState.name || '--' },
  { label: '负责人', value: formState.owner || '--' },
  { label: '类型', value: categories.find(item => item.value === formState.category)?.label ?? '--' },
  { label: '预算', value: `${formState.budget} 万` },
  { label: '节奏', value: paceOptions.find(item => item.value === formState.pace)?.label ?? '--' },
  { label: '风险级别', value: riskLevel.value },
])

watch(
  () => formState.urgent,
  (value) => {
    if (value) {
      formState.pace = 'fast'
    }
  },
)

const nameModel = changeModel<string>('formState.name')
const ownerModel = changeModel<string>('formState.owner')
const categoryModel = changeModel<string>('formState.category')
const urgentModel = changeModel<boolean>('formState.urgent')
const budgetModel = changeModel<number>('formState.budget')
const paceModel = changeModel<string>('formState.pace')
const descriptionModel = changeModel<string>('formState.description')
const attachmentsModel = changeModel<UploadFile[], 'files'>('formState.attachments', {
  valueProp: 'files',
  parser: event => event?.detail?.files ?? [],
})

function showToast(message: string, theme: 'success' | 'warning' = 'success') {
  if (!mpContext) {
    return
  }
  Toast({
    selector: '#t-toast',
    context: mpContext as any,
    message,
    theme,
    duration: 1200,
  })
}

function goNext() {
  if (!canGoNext.value) {
    showToast('请先完善当前步骤信息', 'warning')
    return
  }
  if (currentStep.value < steps.length - 1) {
    currentStep.value += 1
  }
}

function goPrev() {
  if (currentStep.value > 0) {
    currentStep.value -= 1
  }
}

function submit() {
  submitted.value = true
  showToast('提交成功')
}
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#fff7ed] via-[#ffffff] to-[#fef3c7] p-[20rpx]">
      <SectionTitle title="项目提报" subtitle="示例多步表单与联动校验" />
      <view class="mt-[12rpx]">
        <t-steps :current="currentStep" layout="horizontal">
          <t-step-item v-for="item in steps" :key="item.key" :title="item.title" />
        </t-steps>
      </view>
    </view>

    <view class="mt-[18rpx] space-y-[14rpx]">
      <FormStep
        v-if="currentStep === 0"
        :step="1"
        title="基础信息"
        subtitle="填写核心字段"
        :active="currentStep === 0"
      >
        <view class="flex flex-col gap-[14rpx]">
          <FormRow label="项目名称">
            <t-input
              placeholder="例如：新客增长计划"
              :value="nameModel.value"
              @change="nameModel.onChange"
            />
          </FormRow>
          <FormRow label="负责人">
            <t-input
              placeholder="例如：王凯"
              :value="ownerModel.value"
              @change="ownerModel.onChange"
            />
          </FormRow>
          <FormRow label="类型">
            <t-radio-group :value="categoryModel.value" @change="categoryModel.onChange">
              <t-radio v-for="item in categories" :key="item.value" :value="item.value" :label="item.label" />
            </t-radio-group>
          </FormRow>
          <FormRow label="加急">
            <t-switch :value="urgentModel.value" @change="urgentModel.onChange" />
          </FormRow>
        </view>
      </FormStep>

      <FormStep
        v-if="currentStep === 1"
        :step="2"
        title="执行策略"
        subtitle="预算与节奏"
        :active="currentStep === 1"
      >
        <view class="flex flex-col gap-[14rpx]">
          <FormRow label="预算规模" description="10-100 万">
            <view class="flex items-center gap-[12rpx]">
              <t-slider
                :value="budgetModel.value"
                :min="10"
                :max="100"
                @change="budgetModel.onChange"
              />
              <text class="text-[22rpx] text-[#5c5b7a]">
                {{ formState.budget }} 万
              </text>
            </view>
          </FormRow>
          <FormRow label="推进节奏">
            <t-radio-group :value="paceModel.value" @change="paceModel.onChange">
              <t-radio v-for="item in paceOptions" :key="item.value" :value="item.value" :label="item.label" />
            </t-radio-group>
          </FormRow>
          <FormRow label="补充说明">
            <t-textarea
              placeholder="描述目标与资源安排"
              :value="descriptionModel.value"
              :maxlength="140"
              @change="descriptionModel.onChange"
            />
          </FormRow>
          <FormRow label="附件">
            <t-upload
              :files="attachmentsModel.files"
              :max="3"
              @change="attachmentsModel.onChange"
            />
          </FormRow>
        </view>
      </FormStep>

      <FormStep
        v-if="currentStep === 2"
        :step="3"
        title="确认提交"
        subtitle="预览关键信息"
        :active="currentStep === 2"
      >
        <ResultCard title="提交摘要" :items="summaryRows">
          <template #action>
            <t-tag size="small" theme="primary" variant="light">
              {{ riskLevel }}
            </t-tag>
          </template>
        </ResultCard>
      </FormStep>
    </view>

    <view class="mt-[18rpx] flex gap-[12rpx]">
      <t-button block variant="outline" theme="default" :disabled="currentStep === 0" @tap="goPrev">
        上一步
      </t-button>
      <t-button
        block
        theme="primary"
        :disabled="currentStep === steps.length - 1 && submitted"
        @tap="currentStep === steps.length - 1 ? submit() : goNext()"
      >
        {{ currentStep === steps.length - 1 ? (submitted ? '已提交' : '提交') : '下一步' }}
      </t-button>
    </view>

    <t-toast id="t-toast" />
  </view>
</template>
