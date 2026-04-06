import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DEFAULT_ICON_CLASS, resolveIconClass } from '../../utils/app-helpers';

@Component({
  selector: 'app-icon-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="icon-preview"
      [class.icon-preview--compact]="size() === 'compact'"
      [class.icon-preview--large]="size() === 'large'"
      [attr.aria-label]="label()"
      role="img"
    >
      <i [class]="resolvedClass()" aria-hidden="true"></i>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .icon-preview {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.9rem;
      height: 2.9rem;
      border-radius: 50%;
      color: var(--ha-graphite);
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(239, 228, 207, 0.9)),
        rgba(255, 255, 255, 0.88);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 22px rgba(44, 33, 18, 0.14);
      border: 1px solid rgba(200, 167, 96, 0.3);
      font-size: 1rem;
    }

    .icon-preview--compact {
      width: 2.45rem;
      height: 2.45rem;
      font-size: 0.92rem;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 8px 18px rgba(44, 33, 18, 0.11);
    }

    .icon-preview--large {
      width: 4.3rem;
      height: 4.3rem;
      font-size: 1.55rem;
    }
  `,
})
export class IconPreviewComponent {
  readonly iconClass = input(DEFAULT_ICON_CLASS);
  readonly label = input('Preset icon');
  readonly size = input<'compact' | 'default' | 'large'>('default');

  protected readonly resolvedClass = computed(() => resolveIconClass(this.iconClass()));
}
