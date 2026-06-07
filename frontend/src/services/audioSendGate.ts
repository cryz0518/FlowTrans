import type { InputSource } from "../types/events";

export function shouldSendCapturedAudio(inputSource: InputSource, ttsPlaybackActive: boolean) {
  return inputSource !== "system" || !ttsPlaybackActive;
}
