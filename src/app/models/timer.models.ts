export type RepeatMode = 'infinite' | 'count';

export type TimerPhase = 'idle' | 'running' | 'alert' | 'paused' | 'completed';

export interface Preset {
  id: string;
  name: string;
  iconClass: string;
  durationSeconds: number;
  repeatMode: RepeatMode;
  repeatCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresetInput {
  id?: string | null;
  name: string;
  iconClass: string;
  durationSeconds: number;
  repeatMode: RepeatMode;
  repeatCount: number | null;
}

export interface RunOverride {
  mode: 'preset' | 'infinite' | 'count';
  repeatCount: number | null;
}

export interface TimerState {
  activePresetId: string | null;
  phase: TimerPhase;
  remainingSeconds: number;
  currentCycle: number;
  targetCycleCount: number | null;
  muted: boolean;
  alertEndsAt: number | null;
  phaseEndsAt: number | null;
  phaseStartedAt: number | null;
  totalDurationSeconds: number;
  phaseDurationMs: number;
}
