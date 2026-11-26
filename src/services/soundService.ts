import { Platform, Vibration } from 'react-native';

export type ChimeType = 'gentle' | 'start' | 'hourly' | 'urgent' | 'reminder' | 'pending' | 'upcoming';

class SoundService {
  private lastPlayedAt = 0;
  private webAudioCtx: any = null;
  private activePlayer: any = null;
  private singlePlayer: any = null;
  private webGainNode: any = null;
  private isAlarmActive = false;
  private alarmTimeoutId: any = null;
  private alarmIntervalId: any = null;

  private initWebAudio() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    if (!this.webAudioCtx) {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.webAudioCtx = new AudioCtx();
      }
    }
    if (this.webAudioCtx && this.webAudioCtx.state === 'suspended') {
      this.webAudioCtx.resume().catch(() => {});
    }
    return this.webAudioCtx;
  }

  // Stop any ongoing alarm sound or vibration immediately when user clicks OK
  stopAlarm(): void {
    this.isAlarmActive = false;

    if (this.alarmIntervalId) {
      clearInterval(this.alarmIntervalId);
      this.alarmIntervalId = null;
    }

    if (this.alarmTimeoutId) {
      clearTimeout(this.alarmTimeoutId);
      this.alarmTimeoutId = null;
    }

    // 1. Cancel device vibration
    try {
      Vibration.cancel();
    } catch {}

    // 2. Stop and release native audio player if active
    if (this.activePlayer) {
      try {
        this.activePlayer.pause?.();
        this.activePlayer.loop = false;
        this.activePlayer.release?.();
      } catch {}
      this.activePlayer = null;
    }

    if (this.singlePlayer) {
      try {
        this.singlePlayer.pause?.();
        this.singlePlayer.release?.();
      } catch {}
      this.singlePlayer = null;
    }

    // 3. Silence Web Audio if active
    if (this.webGainNode && this.webAudioCtx) {
      try {
        this.webGainNode.gain.setValueAtTime(0, this.webAudioCtx.currentTime);
      } catch {}
    }
  }

  // Play continuous notification sound & vibration until user explicitly acknowledges/stops
  async playContinuousAlarm(): Promise<void> {
    this.stopAlarm(); // Stop any existing sound first
    this.isAlarmActive = true;

    // 1. Tactile rhythmic vibration for mobile (repeat = true means loop indefinitely)
    try {
      Vibration.vibrate([0, 500, 300, 500, 300], true);
    } catch {}

    // 2. Native Mobile Audio with expo-audio (loops alarm_chime.wav indefinitely)
    if (Platform.OS !== 'web') {
      try {
        const { createAudioPlayer } = require('expo-audio');
        const soundAsset = require('../../assets/sounds/routine_alarm_ringtone.mp3');
        this.activePlayer = createAudioPlayer(soundAsset);
        this.activePlayer.loop = true;
        this.activePlayer.play?.();

        // Safety fallback: ensure player remains active and loops continuously
        this.alarmIntervalId = setInterval(() => {
          if (!this.isAlarmActive) {
            clearInterval(this.alarmIntervalId);
            return;
          }
          try {
            if (this.activePlayer && !this.activePlayer.playing) {
              this.activePlayer.play?.();
            }
          } catch {}
        }, 3000);
      } catch (err) {
        console.warn('Native expo-audio playback notice:', err);
      }
    }

    // 3. Web Audio API synthesizer: repeats every 1.2s indefinitely until user clicks OK
    if (Platform.OS === 'web') {
      try {
        const ctx = this.initWebAudio();
        if (ctx) {
          const masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
          masterGain.connect(ctx.destination);
          this.webGainNode = masterGain;

          const playWebPulse = () => {
            if (!this.isAlarmActive) return;
            const nowT = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const noteGain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, nowT); // E5
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(880.0, nowT + 0.1); // A5

            noteGain.gain.setValueAtTime(0.3, nowT);
            noteGain.gain.exponentialRampToValueAtTime(0.001, nowT + 0.85);

            osc1.connect(noteGain);
            osc2.connect(noteGain);
            noteGain.connect(masterGain);

            osc1.start(nowT);
            osc1.stop(nowT + 0.85);
            osc2.start(nowT + 0.1);
            osc2.stop(nowT + 0.85);
          };

          playWebPulse();
          this.alarmIntervalId = setInterval(playWebPulse, 1200);
        }
      } catch (err) {
        console.warn('Web continuous alarm synthesis notice:', err);
      }
    }
  }

  // Distinct one-time notification sound for Pending Backlog tasks (does NOT loop continuously)
  async playPendingNoticeSound(): Promise<void> {
    this.stopAlarm(); // Stop any other sound first

    // 1. Double tactile haptic pulse on mobile (quick tap-tap, non-repeating)
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate([0, 100, 70, 140]);
      } catch {}
    }

    // 2. Web Audio: Distinct double-tone alert (D4 -> G4 chord, plays once)
    if (Platform.OS === 'web') {
      try {
        const ctx = this.initWebAudio();
        if (ctx) {
          const nowT = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(440.0, nowT); // A4
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(659.25, nowT + 0.12); // E5

          gainNode.gain.setValueAtTime(0.25, nowT);
          gainNode.gain.exponentialRampToValueAtTime(0.001, nowT + 0.6);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc1.start(nowT);
          osc1.stop(nowT + 0.6);
          osc2.start(nowT + 0.12);
          osc2.stop(nowT + 0.6);
        }
      } catch (err) {
        console.warn('Web pending sound notice:', err);
      }
    } else {
      // Mobile native: load and play single tune (alarm_chime.mp3)
      try {
        const { createAudioPlayer } = require('expo-audio');
        const soundAsset = require('../../assets/sounds/alarm_chime.mp3');
        if (this.singlePlayer) {
          try {
            this.singlePlayer.pause?.();
            this.singlePlayer.release?.();
          } catch {}
          this.singlePlayer = null;
        }
        this.singlePlayer = createAudioPlayer(soundAsset);
        this.singlePlayer.loop = false;
        this.singlePlayer.play?.();
      } catch (err) {
        console.warn('Native pending sound notice:', err);
      }
    }
  }

  // Play notification chime
  async playExecutiveChime(type: ChimeType = 'gentle'): Promise<void> {
    const now = Date.now();
    if (now - this.lastPlayedAt < 1200) return;
    this.lastPlayedAt = now;

    // Upcoming reminder plays continuous alarm until user acknowledges OK
    if (type === 'upcoming' || type === 'reminder') {
      return this.playContinuousAlarm();
    }

    // Pending backlog plays distinct one-shot sound (does NOT ring continuously)
    if (type === 'pending') {
      return this.playPendingNoticeSound();
    }

    if (type === 'urgent') {
      return this.playContinuousAlarm();
    }

    // For hourly / gentle quick tones:
    if (Platform.OS !== 'web') {
      try {
        if (type === 'hourly') {
          Vibration.vibrate([0, 100, 80, 140]);
        } else {
          Vibration.vibrate(60);
        }
      } catch {}
    }

    if (Platform.OS === 'web') {
      try {
        const ctx = this.initWebAudio();
        if (ctx) {
          const nowT = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, nowT);
          osc.frequency.exponentialRampToValueAtTime(880, nowT + 0.1);
          gain.gain.setValueAtTime(0.2, nowT);
          gain.gain.exponentialRampToValueAtTime(0.001, nowT + 0.8);
          osc.start(nowT);
          osc.stop(nowT + 0.8);
        }
      } catch {}
    }
  }
}

export const soundService = new SoundService();
