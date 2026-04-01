export const DEFAULT_GRANT_FLAGS = {
  clipboardRead: false,
  clipboardWrite: false,
  systemKeyCombos: false,
};

export const API_RESIZE_PARAMS = {};

export function targetImageSize(width, height) {
  return [width, height];
}

export function buildComputerUseTools() {
  return [];
}

export function createComputerUseMcpServer() {
  return {
    setRequestHandler() {},
    async connect() {},
  };
}

export function bindSessionContext() {
  return async () => ({
    content: [{ type: "text", text: "Computer use is unavailable in this local stub build." }],
    isError: true,
    telemetry: { error_kind: "computer_use_stub" },
  });
}
