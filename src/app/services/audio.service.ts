import { Injectable } from '@angular/core';

type AudioContextConstructor = typeof AudioContext;

@Injectable({ providedIn: 'root' })
export class AudioService {
  private context: AudioContext | null = null;
  private unlocked = false;

  async unlock(): Promise<void> {
    const context = this.getContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      await context.resume();
    }

    if (this.unlocked) {
      return;
    }

    const buffer = context.createBuffer(1, 1, 22_050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    this.unlocked = true;
  }

  playChime(): void {
    const context = this.getContext();
    if (!context || context.state === 'suspended') {
      return;
    }

    const now = context.currentTime;
    const output = context.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    output.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    const primary = context.createOscillator();
    primary.type = 'triangle';
    primary.frequency.setValueAtTime(880, now);
    primary.frequency.exponentialRampToValueAtTime(660, now + 0.48);

    const accent = context.createOscillator();
    accent.type = 'sine';
    accent.frequency.setValueAtTime(1320, now);
    accent.frequency.exponentialRampToValueAtTime(990, now + 0.34);

    primary.connect(output);
    accent.connect(output);
    output.connect(context.destination);

    primary.start(now);
    accent.start(now);
    primary.stop(now + 0.58);
    accent.stop(now + 0.45);
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.context) {
      return this.context;
    }

    const maybeWebkitWindow = window as Window & {
      webkitAudioContext?: AudioContextConstructor;
    };

    const ContextConstructor = window.AudioContext ?? maybeWebkitWindow.webkitAudioContext;

    if (!ContextConstructor) {
      return null;
    }

    this.context = new ContextConstructor();
    return this.context;
  }
}
