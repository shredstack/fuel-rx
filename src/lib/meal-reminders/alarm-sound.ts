/**
 * In-app alarm sound + haptics for the foreground meal reminder modal.
 *
 * The OS notification handles sound while backgrounded; this drives the
 * "cannot be ignored" foreground experience. Sound plays the bundled
 * /reminder.wav via an HTMLAudioElement — the Capacitor WebView allows media
 * playback without a user gesture, whereas the Web Audio API's AudioContext
 * stays suspended until one (which made the alarm silent on iOS when the
 * modal auto-opened). A synthesised Web Audio beep remains as fallback for
 * browsers that reject autoplay. Haptics use Capacitor on native, falling
 * back to the Vibration API on web.
 */

import { Capacitor } from '@capacitor/core';

const PULSE_INTERVAL_MS = 2000;
const ALARM_SOUND_URL = '/reminder.wav';

export class AlarmSound {
  private audioCtx: AudioContext | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private soundEnabled = false;
  private hapticsEnabled = false;

  /** Begin the pulsing alarm. Safe to call repeatedly. */
  start(soundEnabled: boolean, hapticsEnabled: boolean): void {
    this.soundEnabled = soundEnabled;
    this.hapticsEnabled = hapticsEnabled;
    if (this.intervalId) return; // already running
    this.pulse(); // fire immediately, then on an interval
    this.intervalId = setInterval(() => this.pulse(), PULSE_INTERVAL_MS);
  }

  /** Stop the alarm and release audio resources. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private pulse(): void {
    if (this.soundEnabled) this.playSound();
    if (this.hapticsEnabled) void this.haptic();
  }

  private playSound(): void {
    try {
      if (typeof window === 'undefined' || typeof Audio === 'undefined') {
        this.beep();
        return;
      }
      if (!this.audioEl) {
        this.audioEl = new Audio(ALARM_SOUND_URL);
        this.audioEl.preload = 'auto';
      }
      this.audioEl.currentTime = 0;
      const playback = this.audioEl.play();
      if (playback) playback.catch(() => this.beep());
    } catch {
      this.beep();
    }
  }

  private beep(): void {
    try {
      if (typeof window === 'undefined') return;
      if (!this.audioCtx) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) return;
        this.audioCtx = new Ctx();
      }
      const ctx = this.audioCtx;
      // Autoplay policy may suspend the context until a user gesture.
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    } catch {
      // Audio is best-effort — haptics and the visible modal still nag.
    }
  }

  private async haptic(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200);
      }
    } catch {
      // Haptics are best-effort.
    }
  }
}
