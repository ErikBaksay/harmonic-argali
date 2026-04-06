import { Injectable, signal } from '@angular/core';
import { Preset, PresetInput } from '../models/timer.models';
import { createPresetId, normalizePresetName, resolveIconClass, sanitizeRepeatCount } from '../utils/app-helpers';

interface PersistedStateV1 {
  version: 1;
  presets: Preset[];
  selectedPresetId: string | null;
  muted: boolean;
}

export const APP_STORAGE_KEY = 'harmonic-argali.storage.v1';
export const APP_STORAGE_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class PresetStorageService {
  readonly presets = signal<Preset[]>([]);
  readonly selectedPresetId = signal<string | null>(null);
  readonly muted = signal(false);

  constructor() {
    const snapshot = this.loadSnapshot();
    this.presets.set(snapshot.presets);
    this.selectedPresetId.set(snapshot.selectedPresetId);
    this.muted.set(snapshot.muted);
  }

  upsertPreset(input: PresetInput): Preset {
    const now = new Date().toISOString();
    const normalizedName = normalizePresetName(input.name);
    const repeatCount = input.repeatMode === 'count' ? sanitizeRepeatCount(input.repeatCount) : null;

    const existing = input.id ? this.presets().find((preset) => preset.id === input.id) : null;
    const nextPreset: Preset = {
      id: existing?.id ?? input.id ?? createPresetId(),
      name: normalizedName,
      iconClass: resolveIconClass(input.iconClass),
      durationSeconds: Math.max(1, Math.floor(input.durationSeconds)),
      repeatMode: input.repeatMode,
      repeatCount,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.presets.update((currentPresets) => {
      const existingIndex = currentPresets.findIndex((preset) => preset.id === nextPreset.id);

      if (existingIndex === -1) {
        return [...currentPresets, nextPreset];
      }

      return currentPresets.map((preset) => (preset.id === nextPreset.id ? nextPreset : preset));
    });

    this.selectedPresetId.set(nextPreset.id);
    this.persist();
    return nextPreset;
  }

  deletePreset(id: string): void {
    this.presets.update((currentPresets) => currentPresets.filter((preset) => preset.id !== id));

    if (this.selectedPresetId() === id) {
      this.selectedPresetId.set(this.presets()[0]?.id ?? null);
    }

    this.persist();
  }

  setSelectedPresetId(id: string | null): void {
    if (id !== null && !this.presets().some((preset) => preset.id === id)) {
      return;
    }

    this.selectedPresetId.set(id);
    this.persist();
  }

  setMuted(muted: boolean): void {
    this.muted.set(muted);
    this.persist();
  }

  private loadSnapshot(): PersistedStateV1 {
    const fallbackState: PersistedStateV1 = {
      version: APP_STORAGE_VERSION,
      presets: [],
      selectedPresetId: null,
      muted: false,
    };

    if (typeof localStorage === 'undefined') {
      return fallbackState;
    }

    try {
      const rawValue = localStorage.getItem(APP_STORAGE_KEY);
      if (!rawValue) {
        this.persistSnapshot(fallbackState);
        return fallbackState;
      }

      const parsed = JSON.parse(rawValue) as Partial<PersistedStateV1>;
      if (parsed.version !== APP_STORAGE_VERSION) {
        this.persistSnapshot(fallbackState);
        return fallbackState;
      }

      const presets = sanitizePresets(parsed.presets);
      const selectedPresetId =
        typeof parsed.selectedPresetId === 'string' && presets.some((preset) => preset.id === parsed.selectedPresetId)
          ? parsed.selectedPresetId
          : presets[0]?.id ?? null;

      const snapshot: PersistedStateV1 = {
        version: APP_STORAGE_VERSION,
        presets,
        selectedPresetId,
        muted: Boolean(parsed.muted),
      };

      this.persistSnapshot(snapshot);
      return snapshot;
    } catch {
      this.persistSnapshot(fallbackState);
      return fallbackState;
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    this.persistSnapshot({
      version: APP_STORAGE_VERSION,
      presets: this.presets(),
      selectedPresetId: this.selectedPresetId(),
      muted: this.muted(),
    });
  }

  private persistSnapshot(snapshot: PersistedStateV1): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(snapshot));
  }
}

function sanitizePresets(value: unknown): Preset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitized = value
    .map((entry) => sanitizePreset(entry))
    .filter((preset): preset is Preset => preset !== null);

  return sanitized;
}

function sanitizePreset(value: unknown): Preset | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const preset = value as Partial<Preset>;
  const name = typeof preset.name === 'string' ? normalizePresetName(preset.name) : '';
  const durationSeconds =
    typeof preset.durationSeconds === 'number' && Number.isFinite(preset.durationSeconds)
      ? Math.max(1, Math.floor(preset.durationSeconds))
      : null;
  const repeatMode = preset.repeatMode === 'count' ? 'count' : 'infinite';
  const repeatCount = repeatMode === 'count' ? sanitizeRepeatCount(preset.repeatCount) : null;

  if (!preset.id || !name || durationSeconds === null) {
    return null;
  }

  const createdAt = typeof preset.createdAt === 'string' ? preset.createdAt : new Date().toISOString();
  const updatedAt = typeof preset.updatedAt === 'string' ? preset.updatedAt : createdAt;

  return {
    id: preset.id,
    name,
    iconClass: resolveIconClass(typeof preset.iconClass === 'string' ? preset.iconClass : ''),
    durationSeconds,
    repeatMode,
    repeatCount,
    createdAt,
    updatedAt,
  };
}
