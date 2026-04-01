let active = false;

export function isNativeAudioAvailable() {
  return false;
}

export function isNativeRecordingActive() {
  return active;
}

export function startNativeRecording() {
  active = false;
  return false;
}

export function stopNativeRecording() {
  active = false;
}
