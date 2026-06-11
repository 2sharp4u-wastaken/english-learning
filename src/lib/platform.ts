/**
 * M1 (2026-06-11): Android Chrome's webkitSpeechRecognition runs through the
 * Google speech service and hears SILENCE while the page holds any other
 * getUserMedia stream — permission granted, green mic dot on (that dot is OUR
 * stream), recognition picks up nothing. Desktop Chrome shares the device
 * between consumers, which is why this never reproduced on the Mac. Every
 * parallel-capture feature (the micHold keep-alive, the hear-yourself
 * recorder) must therefore stay OFF on Android. See docs/backlog.md → M1.
 */
export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
}
