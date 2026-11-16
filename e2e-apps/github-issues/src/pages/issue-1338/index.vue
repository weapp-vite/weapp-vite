<script setup lang="ts">
import { AbortControllerPolyfill, FormDataPolyfill, URLPolyfill, URLSearchParamsPolyfill } from '@wevu/web-apis'

definePageJson({ navigationBarTitleText: 'issue-1338' })
definePageMeta({ layout: false })

function runWebApis() {
  const relative = new URLPolyfill('../api', 'https://example.com/page')
  const credentials = new URLPolyfill('https://user:pass@example.com:8080/path')
  const ipv6 = new URLPolyfill('http://[::1]:8080/api')
  const normalized = new URLPolyfill('https://example.com:443/a/b/../c/./d')

  const deleteParams = new URLSearchParamsPolyfill('a=1&a=2&b=3')
  deleteParams.delete('a', '2')
  const setParams = new URLSearchParamsPolyfill('a=1&b=2&a=3')
  setParams.set('a', 'x')

  const form = new FormDataPolyfill()
  form.append('key', 'uploads/a.txt')
  form.append('file', 'payload')
  form.set('key', 'uploads/b.txt')

  const defaultAbort = new AbortControllerPolyfill()
  defaultAbort.abort()
  const explicitAbort = new AbortControllerPolyfill()
  explicitAbort.abort('timeout')
  let explicitReason: unknown
  try {
    explicitAbort.signal.throwIfAborted()
  }
  catch (reason) {
    explicitReason = reason
  }

  return {
    abort: {
      defaultReasonName: defaultAbort.signal.reason?.name,
      explicitReason,
    },
    credentials: {
      host: credentials.host,
      password: credentials.password,
      username: credentials.username,
    },
    form: [...form],
    ipv6: {
      hostname: ipv6.hostname,
      port: ipv6.port,
    },
    normalized: {
      href: normalized.href,
      pathname: normalized.pathname,
      port: normalized.port,
    },
    relative: relative.href,
    search: {
      deleteByValue: deleteParams.toString(),
      setOrder: setParams.toString(),
    },
  }
}

const snapshot = runWebApis()

function _runE2E() {
  return runWebApis()
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view id="issue-1338-page">
    <text id="issue1338-summary">issue-1338 Web API compatibility</text>
    <text id="issue1338-relative">relative: {{ snapshot.relative }}</text>
    <text id="issue1338-search">search: {{ snapshot.search.deleteByValue }} / {{ snapshot.search.setOrder }}</text>
    <text id="issue1338-abort">abort: {{ snapshot.abort.defaultReasonName }} / {{ snapshot.abort.explicitReason }}</text>
  </view>
</template>
