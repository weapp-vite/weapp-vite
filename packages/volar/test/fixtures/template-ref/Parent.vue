<script setup lang="ts">
import type { TemplateRefValue } from 'wevu'
import { useTemplateRef } from 'wevu'
import Child from './Child.vue'

type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T

const viewRef = useTemplateRef('viewRef')
const mapRef = useTemplateRef('mapRef')
const repeatedRef = useTemplateRef('repeatedRef')
const childRef = useTemplateRef('childRef')
const explicitRef = useTemplateRef<{ code: number }>('manualRef')

const viewContract: Assert<Equal<typeof viewRef.value, TemplateRefValue | null>> = true
const mapContract: Assert<Equal<typeof mapRef.value, TemplateRefValue | null>> = true
const repeatedContract: Assert<Equal<typeof repeatedRef.value, TemplateRefValue[] | null>> = true
const explicitContract: Assert<Equal<typeof explicitRef.value, { code: number } | null>> = true
const open = childRef.value?.open
const componentContract: Assert<Equal<typeof open, ((count: number) => number) | undefined>> = true

void [viewContract, mapContract, repeatedContract, explicitContract, componentContract]
</script>

<template>
  <view ref="viewRef" />
  <map ref="mapRef" />
  <view v-for="index in 2" :key="index" ref="repeatedRef" />
  <Child ref="childRef" />
</template>
