import * as pinia from 'pinia'
import * as vue from 'vue'
import * as wevu from '../../src/reactivity'
import { createApp } from '../../src/runtime/app'
import { nextTick } from '../../src/scheduler'
import * as stores from '../../src/store'

export const implementations = [
  { name: 'pinia', api: pinia, reactive: vue, tick: () => vue.nextTick(), app: () => vue.createApp({}) },
  { name: 'wevu', api: stores, reactive: wevu, tick: () => nextTick(), app: () => createApp({}) },
]
