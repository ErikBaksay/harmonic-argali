import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CustomSelectComponent, CustomSelectOption } from './components/custom-select/custom-select';
import { IconPreviewComponent } from './components/icon-preview/icon-preview';
import { Preset, RepeatMode, RunOverride } from './models/timer.models';
import { PresetStorageService } from './services/preset-storage.service';
import { TimerEngineService } from './services/timer-engine.service';
import {
  ALERT_DURATION_SECONDS,
  DEFAULT_REPEAT_COUNT,
  describePresetRepeat,
  formatClock,
  formatDurationInput,
  normalizePresetName,
  parseDurationInput,
  repeatModeLabel,
  resolveIconClass,
  sanitizeRepeatCount,
} from './utils/app-helpers';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, IconPreviewComponent, CustomSelectComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = 'Harmonic Argali';
  protected readonly alertDurationSeconds = ALERT_DURATION_SECONDS;
  protected readonly formatClock = formatClock;

  protected readonly storage = inject(PresetStorageService);
  protected readonly timer = inject(TimerEngineService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly presets = this.storage.presets.asReadonly();
  protected readonly selectedPresetId = this.storage.selectedPresetId.asReadonly();
  protected readonly timerState = this.timer.state.asReadonly();
  protected readonly timerProgress = this.timer.phaseProgress.asReadonly();
  protected readonly editingPresetId = signal<string | null>(null);
  protected readonly sidebarExpanded = signal(false);
  protected readonly activeSheet = signal<'editor' | null>(null);

  protected readonly presetForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, this.nonBlankValidator]],
    duration: ['01:00', [Validators.required, this.durationValidator]],
    iconClass: ['fa-solid fa-hourglass-half'],
    repeatMode: ['infinite' as RepeatMode, Validators.required],
    repeatCount: [DEFAULT_REPEAT_COUNT],
  });

  protected readonly runForm = this.formBuilder.nonNullable.group({
    repeatMode: ['preset' as RunOverride['mode'], Validators.required],
    repeatCount: [DEFAULT_REPEAT_COUNT],
  });
  protected readonly runRepeatModeOptions: readonly CustomSelectOption<RunOverride['mode']>[] = [
    {
      value: 'preset',
      label: 'Use preset default',
      detail: 'Follow the repeat style saved on this preset.',
    },
    {
      value: 'infinite',
      label: 'Repeat until stopped',
      detail: 'Keep cycling continuously until you stop the timer.',
    },
    {
      value: 'count',
      label: 'Run a fixed number of cycles',
      detail: 'End automatically after the cycle count below.',
    },
  ];
  protected readonly presetRepeatModeOptions: readonly CustomSelectOption<RepeatMode>[] = [
    {
      value: 'infinite',
      label: 'Repeat until stopped',
      detail: 'This preset defaults to an endless loop.',
    },
    {
      value: 'count',
      label: 'Fixed number of cycles',
      detail: 'This preset ends after the saved cycle count.',
    },
  ];

  protected readonly selectedPreset = computed(
    () => this.presets().find((preset) => preset.id === this.selectedPresetId()) ?? null,
  );
  protected readonly hasPresets = computed(() => this.presets().length > 0);
  protected readonly isEditorSheetOpen = computed(() => this.activeSheet() === 'editor');
  protected readonly isSheetOpen = computed(() => this.activeSheet() !== null);

  protected readonly displayPreset = computed(() => {
    const activePresetId = this.timerState().activePresetId;
    return this.presets().find((preset) => preset.id === activePresetId) ?? this.selectedPreset();
  });

  protected readonly displaySeconds = computed(() => {
    const timerState = this.timerState();

    if (timerState.phase === 'idle') {
      return this.selectedPreset()?.durationSeconds ?? 0;
    }

    return timerState.remainingSeconds;
  });

  protected readonly displayTime = computed(() => formatClock(this.displaySeconds()));

  protected readonly progressPercent = computed(() => Math.round(this.timerProgress() * 100));
  protected readonly showVisualAlertPulse = computed(
    () => this.timerState().phase === 'alert' && this.timerState().visualAlertsEnabled,
  );

  protected readonly timerHeadline = computed(() => {
    const phase = this.timerState().phase;

    switch (phase) {
      case 'running':
        return 'Running';
      case 'alert':
        return 'Cycle complete';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Sequence complete';
      case 'idle':
      default:
        return this.hasPresets() ? 'Ready to begin' : 'Create your first preset';
    }
  });

  protected readonly timerSummary = computed(() => {
    const phase = this.timerState().phase;

    if (!this.displayPreset()) {
      return 'Set up a preset with a name, icon, duration, and repeat style. Then you can loop it as long as you want.';
    }

    switch (phase) {
      case 'running':
        return 'The current interval is active and will loop automatically after the alert phase.';
      case 'alert':
        return 'The alert phase is signaling the transition into the next cycle.';
      case 'paused':
        return 'This run is paused in place and can continue from the same moment.';
      case 'completed':
        return 'The requested number of cycles has finished.';
      case 'idle':
      default:
        return 'Choose a preset, decide how this run should repeat, and start when ready.';
    }
  });

  protected readonly cycleLabel = computed(() => {
    const state = this.timerState();

    if (!this.displayPreset()) {
      return 'No preset selected';
    }

    if (state.phase === 'idle') {
      return 'Ready when you are';
    }

    if (state.targetCycleCount === null) {
      return `Cycle ${Math.max(1, state.currentCycle)} · repeats until stopped`;
    }

    return `Cycle ${Math.max(1, state.currentCycle)} of ${state.targetCycleCount}`;
  });

  protected readonly repeatSummary = computed(() => {
    const preset = this.displayPreset();
    const state = this.timerState();

    if (!preset) {
      return 'No run settings yet';
    }

    if (state.phase !== 'idle') {
      return state.targetCycleCount === null ? 'Repeats until stopped' : `${state.targetCycleCount} cycles total`;
    }

    return repeatModeLabel(preset.repeatMode, preset.repeatCount);
  });

  protected readonly currentPresetDetails = computed(() => {
    const preset = this.displayPreset();

    if (!preset) {
      return 'Use the sidebar to create or choose a preset.';
    }

    return `${formatClock(preset.durationSeconds)} each cycle · ${repeatModeLabel(preset.repeatMode, preset.repeatCount)}`;
  });

  protected readonly isPresetSelectionLive = computed(() => {
    const phase = this.timerState().phase;
    return phase === 'running' || phase === 'alert' || phase === 'paused';
  });

  protected readonly canStart = computed(() => this.selectedPreset() !== null);

  constructor() {
    this.configureConditionalValidators();

    effect(() => {
      const preset = this.selectedPreset();
      if (preset) {
        this.applyRunPresetDefaults(preset);
      } else {
        this.runForm.reset(
          {
            repeatMode: 'preset',
            repeatCount: DEFAULT_REPEAT_COUNT,
          },
          { emitEvent: false },
        );
        this.updateRunRepeatValidators(this.runForm.controls.repeatMode.value);
      }
    });
  }

  protected trackPreset(_: number, preset: Preset): string {
    return preset.id;
  }

  protected async unlockAudio(): Promise<void> {
    await this.timer.unlockAudio();
  }

  protected toggleSidebar(): void {
    this.sidebarExpanded.update((expanded) => !expanded);
  }

  protected openSidebar(): void {
    this.sidebarExpanded.set(true);
  }

  protected closeSidebar(): void {
    this.sidebarExpanded.set(false);
  }

  protected openNewPresetSheet(): void {
    this.prepareNewPreset();
    this.closeSidebar();
    this.activeSheet.set('editor');
  }

  protected closeSheet(): void {
    this.activeSheet.set(null);
  }

  protected selectPreset(preset: Preset): void {
    this.storage.setSelectedPresetId(preset.id);
    this.applyRunPresetDefaults(preset);
    this.closeSidebar();

    if (this.isPresetSelectionLive()) {
      this.timer.start(preset, { mode: 'preset', repeatCount: null });
    }
  }

  protected editPreset(preset: Preset): void {
    this.editingPresetId.set(preset.id);
    this.presetForm.setValue({
      name: preset.name,
      duration: formatDurationInput(preset.durationSeconds),
      iconClass: preset.iconClass,
      repeatMode: preset.repeatMode,
      repeatCount: preset.repeatCount ?? DEFAULT_REPEAT_COUNT,
    });
    this.presetForm.markAsUntouched();
    this.closeSidebar();
    this.activeSheet.set('editor');
  }

  protected prepareNewPreset(): void {
    this.editingPresetId.set(null);
    this.presetForm.reset({
      name: '',
      duration: '01:00',
      iconClass: 'fa-solid fa-hourglass-half',
      repeatMode: 'infinite',
      repeatCount: DEFAULT_REPEAT_COUNT,
    });
    this.presetForm.markAsUntouched();
  }

  protected savePreset(): void {
    this.presetForm.markAllAsTouched();

    if (this.presetForm.invalid) {
      return;
    }

    const name = normalizePresetName(this.presetForm.controls.name.value);
    const durationSeconds = parseDurationInput(this.presetForm.controls.duration.value);
    const repeatMode = this.presetForm.controls.repeatMode.value;
    const repeatCount =
      repeatMode === 'count' ? sanitizeRepeatCount(this.presetForm.controls.repeatCount.value) : null;

    if (!name || durationSeconds === null) {
      return;
    }

    const savedPreset = this.storage.upsertPreset({
      id: this.editingPresetId(),
      name,
      durationSeconds,
      iconClass: resolveIconClass(this.presetForm.controls.iconClass.value),
      repeatMode,
      repeatCount,
    });

    this.storage.setSelectedPresetId(savedPreset.id);
    this.applyRunPresetDefaults(savedPreset);
    this.editingPresetId.set(savedPreset.id);
    this.closeSheet();
    this.closeSidebar();
  }

  protected deletePreset(preset: Preset): void {
    if (this.timerState().activePresetId === preset.id) {
      this.timer.stop();
    }

    this.storage.deletePreset(preset.id);

    if (this.editingPresetId() === preset.id) {
      this.prepareNewPreset();
    }

    const nextSelectedPreset = this.selectedPreset();
    if (nextSelectedPreset) {
      this.applyRunPresetDefaults(nextSelectedPreset);
    } else {
      this.closeSheet();
    }
  }

  protected async startSelectedPreset(): Promise<void> {
    const preset = this.selectedPreset();
    if (!preset) {
      return;
    }

    await this.timer.unlockAudio();
    this.timer.start(preset, this.resolveRunOverride());
  }

  protected pauseTimer(): void {
    this.timer.pause();
  }

  protected async resumeTimer(): Promise<void> {
    await this.timer.unlockAudio();
    this.timer.resume();
  }

  protected stopTimer(): void {
    this.timer.stop();
  }

  protected toggleMute(): void {
    this.timer.setMuted(!this.timerState().muted);
  }

  protected toggleVisualAlerts(): void {
    this.timer.setVisualAlertsEnabled(!this.timerState().visualAlertsEnabled);
  }

  protected describePreset(preset: Preset): string {
    return `${formatClock(preset.durationSeconds)} · ${describePresetRepeat(preset)}`;
  }

  protected showPresetError(controlName: 'name' | 'duration' | 'repeatCount'): boolean {
    const control = this.presetForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected showRunRepeatError(): boolean {
    const control = this.runForm.controls.repeatCount;
    return this.runForm.controls.repeatMode.value === 'count' && control.invalid && (control.dirty || control.touched);
  }

  protected previewIconClass(): string {
    return resolveIconClass(this.presetForm.controls.iconClass.value);
  }

  private applyRunPresetDefaults(preset: Preset): void {
    this.runForm.reset(
      {
        repeatMode: 'preset',
        repeatCount: preset.repeatCount ?? DEFAULT_REPEAT_COUNT,
      },
      { emitEvent: false },
    );
    this.updateRunRepeatValidators(this.runForm.controls.repeatMode.value);
  }

  private resolveRunOverride(): RunOverride {
    const mode = this.runForm.controls.repeatMode.value;
    return {
      mode,
      repeatCount: mode === 'count' ? sanitizeRepeatCount(this.runForm.controls.repeatCount.value) : null,
    };
  }

  private configureConditionalValidators(): void {
    this.presetForm.controls.repeatMode.valueChanges
      .pipe(startWith(this.presetForm.controls.repeatMode.value), takeUntilDestroyed())
      .subscribe((mode) => this.updatePresetRepeatValidators(mode));

    this.runForm.controls.repeatMode.valueChanges
      .pipe(startWith(this.runForm.controls.repeatMode.value), takeUntilDestroyed())
      .subscribe((mode) => this.updateRunRepeatValidators(mode));
  }

  private updatePresetRepeatValidators(mode: RepeatMode): void {
    const control = this.presetForm.controls.repeatCount;

    if (mode === 'count') {
      control.setValidators([Validators.required, Validators.min(1), Validators.max(999)]);
    } else {
      control.clearValidators();
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private updateRunRepeatValidators(mode: RunOverride['mode']): void {
    const control = this.runForm.controls.repeatCount;

    if (mode === 'count') {
      control.setValidators([Validators.required, Validators.min(1), Validators.max(999)]);
    } else {
      control.clearValidators();
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private nonBlankValidator(control: AbstractControl<string>): ValidationErrors | null {
    return normalizePresetName(control.value).length > 0 ? null : { blank: true };
  }

  private durationValidator(control: AbstractControl<string>): ValidationErrors | null {
    return parseDurationInput(control.value) !== null ? null : { duration: true };
  }
}
