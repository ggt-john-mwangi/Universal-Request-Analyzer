// message-handler.js
const pendingResponses = {};
export function generateRequestId() {
  return "req_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
}

chrome.runtime.onMessage.addListener((msg) => {
  const { requestId } = msg;
  if (requestId && typeof pendingResponses[requestId] === 'function') {
    pendingResponses[requestId](msg);
    delete pendingResponses[requestId];
  }
});

export function sendMessageWithResponse(action, data = {}) {
  return new Promise((resolve) => {
    const requestId = generateRequestId();
    pendingResponses[requestId] = resolve;
    chrome.runtime.sendMessage({ action, requestId, data });
  });
}

export function sendMessageWithResponseFlatPayload(action, data = {}, wrap = true) {
  return new Promise((resolve) => {
    const requestId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    pendingResponses[requestId] = resolve;
    const message = wrap
      ? { action, requestId, data }
      : { ...data, action, requestId };
    chrome.runtime.sendMessage(message);
  });
}
