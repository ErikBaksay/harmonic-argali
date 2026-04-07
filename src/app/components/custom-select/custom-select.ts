import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  detail?: string;
}

@Component({
  selector: 'app-custom-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="custom-select" [class.custom-select--open]="open()" [class.custom-select--disabled]="disabled()">
      <button
        class="custom-select__trigger"
        type="button"
        [disabled]="disabled() || options().length === 0"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="toggleOpen()"
        (keydown)="handleTriggerKeydown($event)"
      >
        <span class="custom-select__trigger-copy">
          <span class="custom-select__trigger-label">{{ selectedOption()?.label ?? placeholder() }}</span>
        </span>

        <span class="custom-select__trigger-icon" aria-hidden="true">
          <i class="fa-solid fa-chevron-down"></i>
        </span>
      </button>

      <div class="custom-select__panel" [class.custom-select__panel--open]="open()" role="listbox">
        @for (option of options(); track option.value; let index = $index) {
          <button
            class="custom-select__option"
            [class.custom-select__option--selected]="option.value === value()"
            [class.custom-select__option--highlighted]="index === highlightedIndex()"
            type="button"
            role="option"
            [attr.aria-selected]="option.value === value()"
            tabindex="-1"
            (click)="selectOption(option.value)"
            (pointerenter)="highlightedIndex.set(index)"
          >
            <span class="custom-select__option-copy">
              <span class="custom-select__option-label">{{ option.label }}</span>
              @if (option.detail) {
                <span class="custom-select__option-detail">{{ option.detail }}</span>
              }
            </span>

            <span class="custom-select__option-mark" aria-hidden="true">
              <i class="fa-solid fa-check"></i>
            </span>
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
    }

    .custom-select {
      position: relative;
      isolation: isolate;
    }

    .custom-select--open {
      z-index: 5;
    }

    .custom-select__trigger {
      width: 100%;
      min-height: 3rem;
      padding: 0.44rem 0.5rem 0.44rem 0.95rem;
      border-radius: 1rem;
      border: 1px solid rgba(43, 35, 20, 0.14);
      background:
        linear-gradient(160deg, rgba(255, 255, 255, 0.96), rgba(249, 242, 232, 0.88)),
        rgba(255, 254, 251, 0.9);
      color: var(--ha-graphite);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      text-align: left;
      outline: none;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 24px rgba(52, 39, 18, 0.05);
      transition:
        border-color 140ms ease,
        transform 140ms ease,
        box-shadow 140ms ease,
        background 160ms ease;
    }

    .custom-select__trigger:hover:not(:disabled) {
      border-color: rgba(200, 167, 96, 0.34);
      transform: translateY(-1px);
    }

    .custom-select__trigger:focus-visible,
    .custom-select--open .custom-select__trigger {
      border-color: rgba(200, 167, 96, 0.64);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 0 0 4px rgba(200, 167, 96, 0.12),
        0 14px 28px rgba(52, 39, 18, 0.08);
      transform: translateY(-1px);
    }

    .custom-select__trigger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .custom-select__trigger-copy {
      min-width: 0;
      display: block;
    }

    .custom-select__trigger-label {
      display: block;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      color: var(--ha-graphite);
      line-height: 1.35;
    }

    .custom-select__trigger-icon {
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid rgba(200, 167, 96, 0.24);
      background: rgba(255, 255, 255, 0.76);
      color: rgba(36, 39, 44, 0.7);
      transition:
        transform 180ms ease,
        background 160ms ease,
        color 160ms ease;
    }

    .custom-select--open .custom-select__trigger-icon {
      transform: rotate(180deg);
      background: rgba(245, 232, 204, 0.86);
      color: var(--ha-graphite);
    }

    .custom-select__panel {
      position: absolute;
      top: calc(100% + 0.55rem);
      left: 0;
      right: 0;
      z-index: 2;
      display: grid;
      gap: 0.3rem;
      padding: 0.4rem;
      border-radius: 1.2rem;
      border: 1px solid rgba(43, 35, 20, 0.1);
      background:
        linear-gradient(165deg, rgba(255, 255, 255, 0.98), rgba(248, 241, 229, 0.96)),
        rgba(255, 252, 246, 0.96);
      box-shadow: 0 24px 46px rgba(30, 22, 12, 0.18);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-0.35rem) scale(0.98);
      transform-origin: top center;
      transition:
        opacity 160ms ease,
        transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .custom-select__panel--open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    .custom-select__option {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      padding: 0.8rem 0.85rem;
      border: 0;
      border-radius: 0.95rem;
      background: transparent;
      color: var(--ha-graphite);
      text-align: left;
      transition:
        background 140ms ease,
        transform 140ms ease,
        box-shadow 140ms ease;
    }

    .custom-select__option--highlighted,
    .custom-select__option:hover {
      background: rgba(255, 255, 255, 0.78);
      transform: translateY(-1px);
    }

    .custom-select__option--selected {
      background:
        linear-gradient(145deg, rgba(255, 252, 244, 0.98), rgba(244, 232, 210, 0.9)),
        rgba(255, 255, 255, 0.86);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 22px rgba(44, 33, 18, 0.08);
    }

    .custom-select__option-copy {
      min-width: 0;
      display: grid;
      gap: 0.18rem;
    }

    .custom-select__option-label {
      display: block;
      font-size: 0.96rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      color: var(--ha-graphite);
      line-height: 1.35;
    }

    .custom-select__option-detail {
      display: block;
      font-size: 0.84rem;
      line-height: 1.45;
      letter-spacing: 0;
      text-transform: none;
      color: rgba(36, 39, 44, 0.68);
    }

    .custom-select__option-mark {
      width: 1.75rem;
      height: 1.75rem;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(200, 167, 96, 0.24);
      color: rgba(36, 39, 44, 0.34);
      opacity: 0.55;
      transition:
        opacity 140ms ease,
        color 140ms ease,
        background 140ms ease;
    }

    .custom-select__option--selected .custom-select__option-mark {
      opacity: 1;
      color: #8d6a35;
      background: rgba(246, 236, 209, 0.92);
    }

    @media (prefers-reduced-motion: reduce) {
      .custom-select__trigger,
      .custom-select__trigger-icon,
      .custom-select__panel,
      .custom-select__option,
      .custom-select__option-mark {
        transition: none;
      }
    }
  `,
})
export class CustomSelectComponent implements ControlValueAccessor {
  readonly options = input<readonly CustomSelectOption[]>([]);
  readonly placeholder = input('Choose an option');
  readonly ariaLabel = input('Select an option');

  protected readonly open = signal(false);
  protected readonly highlightedIndex = signal(0);
  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly selectedOption = computed(
    () => this.options().find((option) => option.value === this.value()) ?? null,
  );

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected toggleOpen(): void {
    if (this.disabled() || this.options().length === 0) {
      return;
    }

    if (this.open()) {
      this.close();
      return;
    }

    const selectedIndex = this.options().findIndex((option) => option.value === this.value());
    this.highlightedIndex.set(selectedIndex >= 0 ? selectedIndex : 0);
    this.open.set(true);
  }

  protected selectOption(value: string): void {
    this.value.set(value);
    this.onChange(value);
    this.close();
  }

  protected handleTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.options().length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.toggleOpen();
        } else {
          this.moveHighlight(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) {
          this.toggleOpen();
        } else {
          this.moveHighlight(-1);
        }
        break;
      case 'Home':
        if (this.open()) {
          event.preventDefault();
          this.highlightedIndex.set(0);
        }
        break;
      case 'End':
        if (this.open()) {
          event.preventDefault();
          this.highlightedIndex.set(this.options().length - 1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open()) {
          this.toggleOpen();
        } else {
          const highlightedOption = this.options()[this.highlightedIndex()];
          if (highlightedOption) {
            this.selectOption(highlightedOption.value);
          }
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  protected handleDocumentPointerDown(event: PointerEvent): void {
    const target = event.target;

    if (!this.open() || !(target instanceof Node) || this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.close();
  }

  private moveHighlight(direction: 1 | -1): void {
    const options = this.options();
    if (options.length === 0) {
      return;
    }

    const nextIndex = (this.highlightedIndex() + direction + options.length) % options.length;
    this.highlightedIndex.set(nextIndex);
  }

  private close(): void {
    if (this.open()) {
      this.open.set(false);
    }

    this.onTouched();
  }
}
