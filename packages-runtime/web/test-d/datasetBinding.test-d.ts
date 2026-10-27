import type { DirectiveResult } from 'lit/directive.js'
import { bindRuntimeDataset } from '@weapp-vite/web'
import { expectAssignable, expectError } from 'tsd'

expectAssignable<DirectiveResult>(bindRuntimeDataset('data-item', { id: 'value' }))
expectAssignable<DirectiveResult>(bindRuntimeDataset('data-index', 0))
expectAssignable<DirectiveResult>(bindRuntimeDataset('data-enabled', false))
expectAssignable<DirectiveResult>(bindRuntimeDataset('data-empty', undefined))
expectError(bindRuntimeDataset(1, 'value'))
expectError(bindRuntimeDataset('data-item'))
