import { generateJs } from '@weapp-core/schematics'
import { expectType } from 'tsd'

expectType<'App({})' | 'Page({})' | 'Component({})'>(generateJs('app'))
