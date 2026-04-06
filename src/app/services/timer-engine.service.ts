import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { AudioService } from './audio.service';
import { PresetStorageService } from './preset-storage.service';
import { Preset, RunOverride, TimerPhase, TimerState } from '../models/timer.models';
import { ALERT_DURATION_SECONDS, resolveRepeatTarget } from '../utils/app-helpers';

const ALERT_DURATION_MS = ALERT_DURATION_SECONDS * 1000;
const TICK_INTERVAL_MS = 100;

interface ActiveSession {
  presetId: string;
  durationMs: number;
  targetCycleCount: number | null;
}

interface PausedSession {
  phase: 'running' | 'alert';
  remainingMs: number;
  phaseDurationMs: number;
}

const INITIAL_TIMER_STATE: TimerState = {
  activePresetId: null,
  phase: 'idle',
  remainingSeconds: 0,
  currentCycle: 0,
  targetCycleCount: null,
  muted: false,
  visualAlertsEnabled: true,
  alertEndsAt: null,
  phaseEndsAt: null,
  phaseStartedAt: null,
  totalDurationSeconds: 0,
  phaseDurationMs: 0,
};

@Injectable({ providedIn: 'root' })
export class TimerEngineService {
  readonly state = signal<TimerState>(INITIAL_TIMER_STATE);
  readonly phaseProgress = signal(0);

  private readonly audioService = inject(AudioService);
  private readonly storage = inject(PresetStorageService);
  private readonly destroyRef = inject(DestroyRef);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private activeSession: ActiveSession | null = null;
  private pausedSession: PausedSession | null = null;
  private phaseEndsAt: number | null = null;
  private phaseStartedAt: number | null = null;
  private phaseDurationMs = 0;

  constructor() {
    this.state.update((state) => ({
      ...state,
      muted: this.storage.muted(),
      visualAlertsEnabled: this.storage.visualAlertsEnabled(),
    }));

    effect(() => {
      const muted = this.storage.muted();
      this.state.update((state) => (state.muted === muted ? state : { ...state, muted }));
    });

    effect(() => {
      const visualAlertsEnabled = this.storage.visualAlertsEnabled();
      this.state.update((state) =>
        state.visualAlertsEnabled === visualAlertsEnabled ? state : { ...state, visualAlertsEnabled },
      );
    });

    this.destroyRef.onDestroy(() => this.clearTicker());
  }

  async unlockAudio(): Promise<void> {
    await this.audioService.unlock();
  }

  start(preset: Preset, override: RunOverride = { mode: 'preset', repeatCount: null }): void {
    const targetCycleCount = resolveRepeatTarget(preset, override);
    this.activeSession = {
      presetId: preset.id,
      durationMs: preset.durationSeconds * 1000,
      targetCycleCount,
    };
    this.pausedSession = null;
    this.enterRunningPhase(1, Date.now());
  }

  pause(): void {
    const phase = this.state().phase;
    if (phase !== 'running' && phase !== 'alert') {
      return;
    }

    const now = Date.now();
    const remainingMs = Math.max(0, (this.phaseEndsAt ?? now) - now);
    this.pausedSession = {
      phase,
      remainingMs,
      phaseDurationMs: this.phaseDurationMs,
    };

    this.clearTicker();
    this.syncProgress(remainingMs, this.phaseDurationMs);

    this.state.update((state) => ({
      ...state,
      phase: 'paused',
      remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      alertEndsAt: null,
      phaseEndsAt: null,
      phaseStartedAt: null,
      phaseDurationMs: this.phaseDurationMs,
    }));
  }

  resume(): void {
    if (!this.activeSession || !this.pausedSession) {
      return;
    }

    const anchor = Date.now();
    const currentCycle = this.state().currentCycle;
    const pausedSession = this.pausedSession;
    this.pausedSession = null;

    this.startPhase(pausedSession.phase, currentCycle, pausedSession.phaseDurationMs, pausedSession.remainingMs, anchor, false);
  }

  stop(): void {
    this.clearTicker();
    this.activeSession = null;
    this.pausedSession = null;
    this.phaseEndsAt = null;
    this.phaseStartedAt = null;
    this.phaseDurationMs = 0;
    this.phaseProgress.set(0);
    this.state.set({
      ...INITIAL_TIMER_STATE,
      muted: this.storage.muted(),
      visualAlertsEnabled: this.storage.visualAlertsEnabled(),
    });
  }

  setMuted(muted: boolean): void {
    this.storage.setMuted(muted);
  }

  setVisualAlertsEnabled(enabled: boolean): void {
    this.storage.setVisualAlertsEnabled(enabled);
  }

  private enterRunningPhase(cycle: number, anchor: number): void {
    if (!this.activeSession) {
      return;
    }

    this.startPhase('running', cycle, this.activeSession.durationMs, this.activeSession.durationMs, anchor, false);
  }

  private enterAlertPhase(anchor: number): void {
    this.startPhase('alert', this.state().currentCycle, ALERT_DURATION_MS, ALERT_DURATION_MS, anchor, true);
  }

  private startPhase(
    phase: 'running' | 'alert',
    cycle: number,
    durationMs: number,
    remainingMs: number,
    anchor: number,
    playChime: boolean,
  ): void {
    this.phaseDurationMs = durationMs;
    this.phaseStartedAt = anchor - (durationMs - remainingMs);
    this.phaseEndsAt = anchor + remainingMs;

    if (phase === 'alert' && playChime && !this.storage.muted()) {
      this.audioService.playChime();
    }

    this.ensureTicker();
    this.syncSnapshot(phase, cycle, anchor);
  }

  private tick(): void {
    this.tickAt(Date.now());
  }

  private tickAt(now: number): void {
    const phase = this.state().phase;

    if (phase !== 'running' && phase !== 'alert') {
      return;
    }

    const phaseEnd = this.phaseEndsAt ?? now;

    if (now < phaseEnd) {
      this.syncSnapshot(phase, this.state().currentCycle, now);
      return;
    }

    if (phase === 'running') {
      this.enterAlertPhase(phaseEnd);
      this.tickAt(now);
      return;
    }

    const targetCycleCount = this.activeSession?.targetCycleCount ?? this.state().targetCycleCount;
    const currentCycle = this.state().currentCycle;

    if (targetCycleCount !== null && currentCycle >= targetCycleCount) {
      this.finishCompleted();
      return;
    }

    this.enterRunningPhase(currentCycle + 1, phaseEnd);
    this.tickAt(now);
  }

  private finishCompleted(): void {
    this.clearTicker();
    this.phaseEndsAt = null;
    this.phaseStartedAt = null;
    this.phaseDurationMs = ALERT_DURATION_MS;
    this.phaseProgress.set(1);

    this.state.update((state) => ({
      ...state,
      phase: 'completed',
      remainingSeconds: 0,
      alertEndsAt: null,
      phaseEndsAt: null,
      phaseStartedAt: null,
      phaseDurationMs: ALERT_DURATION_MS,
      muted: this.storage.muted(),
      visualAlertsEnabled: this.storage.visualAlertsEnabled(),
    }));
  }

  private syncSnapshot(phase: TimerPhase, cycle: number, now: number): void {
    const remainingMs = Math.max(0, (this.phaseEndsAt ?? now) - now);
    this.syncProgress(remainingMs, this.phaseDurationMs);

    this.state.update((state) => ({
      ...state,
      activePresetId: this.activeSession?.presetId ?? state.activePresetId,
      phase,
      remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      currentCycle: cycle,
      targetCycleCount: this.activeSession?.targetCycleCount ?? state.targetCycleCount,
      alertEndsAt: phase === 'alert' ? this.phaseEndsAt : null,
      phaseEndsAt: this.phaseEndsAt,
      phaseStartedAt: this.phaseStartedAt,
      totalDurationSeconds: Math.round((this.activeSession?.durationMs ?? state.totalDurationSeconds * 1000) / 1000),
      phaseDurationMs: this.phaseDurationMs,
      muted: this.storage.muted(),
      visualAlertsEnabled: this.storage.visualAlertsEnabled(),
    }));
  }

  private syncProgress(remainingMs: number, durationMs: number): void {
    if (durationMs <= 0) {
      this.phaseProgress.set(0);
      return;
    }

    const progress = Math.min(1, Math.max(0, (durationMs - remainingMs) / durationMs));
    this.phaseProgress.set(progress);
  }

  private ensureTicker(): void {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private clearTicker(): void {
    if (this.intervalId === null) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }
}
