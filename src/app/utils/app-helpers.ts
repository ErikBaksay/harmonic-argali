import { Preset, RepeatMode, RunOverride } from '../models/timer.models';

export const ALERT_DURATION_SECONDS = 5;
export const DEFAULT_ICON_CLASS = 'fa-solid fa-bell';
export const DEFAULT_REPEAT_COUNT = 3;

const FA_STYLE_TOKENS = new Set([
  'fa-solid',
  'fa-regular',
  'fa-brands',
  'fa-light',
  'fa-thin',
  'fa-duotone',
  'fa-sharp',
]);

export function parseDurationInput(input: string): number | null {
  const trimmed = input.trim();

  if (!/^\d{1,3}:\d{2}$/.test(trimmed)) {
    return null;
  }

  const [minutesText, secondsText] = trimmed.split(':');
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);

  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds > 59) {
    return null;
  }

  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds > 0 ? totalSeconds : null;
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value, index) => String(value).padStart(index === 0 ? 1 : 2, '0')).join(':');
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDurationInput(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function isPotentiallyValidFontAwesomeClass(value: string): boolean {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  const hasStyle = tokens.some((token) => FA_STYLE_TOKENS.has(token));
  const hasIconToken = tokens.some((token) => token.startsWith('fa-') && !FA_STYLE_TOKENS.has(token));

  return hasStyle && hasIconToken;
}

export function resolveIconClass(value: string): string {
  return isPotentiallyValidFontAwesomeClass(value)
    ? value
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join(' ')
    : DEFAULT_ICON_CLASS;
}

export function resolveRepeatTarget(preset: Preset, override: RunOverride): number | null {
  switch (override.mode) {
    case 'infinite':
      return null;
    case 'count':
      return sanitizeRepeatCount(override.repeatCount);
    case 'preset':
    default:
      return preset.repeatMode === 'count' ? sanitizeRepeatCount(preset.repeatCount) : null;
  }
}

export function describePresetRepeat(preset: Preset): string {
  if (preset.repeatMode === 'infinite') {
    return 'Infinite';
  }

  return `${sanitizeRepeatCount(preset.repeatCount)} cycles`;
}

export function sanitizeRepeatCount(value: number | null | undefined): number {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 1) {
    return DEFAULT_REPEAT_COUNT;
  }

  return Math.max(1, Math.floor(count));
}

export function normalizePresetName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function createPresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `preset-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function repeatModeLabel(repeatMode: RepeatMode, repeatCount: number | null): string {
  return repeatMode === 'count' ? `${sanitizeRepeatCount(repeatCount)} cycles` : 'Infinite loop';
}
