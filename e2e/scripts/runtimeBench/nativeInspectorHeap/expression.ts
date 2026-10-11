import type { NativeInspectorHeapIdentity } from './protocol'

/** 仅生成由 Computer Use 粘贴到官方 Inspector Console 的文本，不后台执行或连接调试器。 */
export function createNativeInspectorHeapExpression(endpoint: string, token: string, identity: NativeInspectorHeapIdentity) {
  return `(async () => {
  const endpoint = ${JSON.stringify(endpoint)};
  const token = ${JSON.stringify(token)};
  const sessionId = ${JSON.stringify(identity.sessionId)};
  const headers = { 'Content-Type': 'application/json', 'X-Runtime-Bench-Token': token };
  const post = async (path, body) => {
    const result = await fetch(endpoint + path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!result.ok) throw new Error('Native Inspector collector rejected ' + path + ': ' + result.status);
  };
  const targets = () => {
    const all = SDK.targetManager.targets();
    const target = SDK.targetManager.mainTarget();
    if (all.length !== 1 || !target || all[0] !== target) throw new Error('Expected a unique native AppService target');
    return { target, targetId: target.id(), targetUrl: target.inspectedURL(), targetCount: all.length };
  };
  try {
    const initial = targets();
    const isolatePromise = initial.target.runtimeAgent().invoke_getIsolateId({});
    const isolateRequestId = initial.target.router()._lastMessageId;
    const isolate = await isolatePromise;
    await post('/ready', { sessionId, targetId: initial.targetId, targetUrl: initial.targetUrl, targetCount: initial.targetCount, isolateRequestId, isolate, error: isolate.getError() || null });
    for (;;) {
      const next = await fetch(endpoint + '/next', { headers: { 'X-Runtime-Bench-Token': token } });
      if (next.status === 204) return { status: 'stopped' };
      if (!next.ok) throw new Error('Native Inspector collector request failed: ' + next.status);
      const request = await next.json();
      const startedAt = new Date().toISOString();
      const startedMono = performance.now();
      const before = targets();
      const router = before.target.router();
      const isolatePromise = before.target.runtimeAgent().invoke_getIsolateId({});
      const isolateRequestId = router._lastMessageId;
      const isolate = await isolatePromise;
      const sentAt = new Date().toISOString();
      const heapPromise = before.target.runtimeAgent().invoke_getHeapUsage({});
      const requestId = router._lastMessageId;
      const response = await heapPromise;
      const receivedAt = new Date().toISOString();
      const durationMs = performance.now() - startedMono;
      const after = targets();
      await post('/result', {
        sessionId, sequence: request.sequence, nonce: request.nonce,
        raw: {
          targetId: before.targetId, targetUrl: before.targetUrl, targetCount: before.targetCount,
          afterTargetId: after.targetId, afterTargetUrl: after.targetUrl, afterTargetCount: after.targetCount,
          isolateRequestId, isolate, isolateError: isolate.getError() || null, requestId,
          startedAt, sentAt, receivedAt, durationMs, response, error: response.getError() || null
        }
      });
    }
  } catch (error) {
    await post('/failed', { sessionId, message: String(error) });
    throw error;
  }
})()`
}
