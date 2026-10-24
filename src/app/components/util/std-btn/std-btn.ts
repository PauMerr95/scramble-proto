import { Component, effect, inject, input, output } from '@angular/core';
import { ButtonID } from '../../../types/util_types';
import { LayoutService } from '../../../services/layout-service';

@Component({
  selector: 'app-std-btn',
  imports: [],
  template: `
    <div class="btn-wrapper">
      <button class="btn"
      [class.targeted]="this.lyt.currentlyTargeted() === this.id()"
      [class.pseudoactive]="this.lyt.activeBtn() === this.id()"
      (click)="this.onTrigger.emit()">{{innerText()}}</button>
    </div>
  `,
  styles: `
  .btn {
    background-color: var(--color-std-700, #749306);
    border: 2px solid var(--color-std-400, #cef72b);
    border-radius: 10px;
    color: var(--color-std-100, #f3fdce);
    cursor: pointer;
    display: inline-block;
    font-weight: 300;
    font-size: 12px;
    line-height: 25px;
    text-align: center;
    text-decoration: none;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    pointer-events: all;
    font-family: 'Georgia';
  }

  .btn:hover {
    color: var(--color-std-900, #273102);
    background-color: var(--color-std-100, #f3fdce);
  }

  .btn:active {
    transform: translate(2px, 2px);
  }
  .btn.pseudoactive {
    transform: translate(2px, 2px);
  }

  .btn.targeted {
    box-shadow: 0  3px 10px 0 var(--color-std-600, #9bc408),
                0 -3px 10px 0 var(--color-std-600, #9bc408);
  }

  @media (min-width: 768px) {
    .btn {
      min-width: 100px;
      padding: 0 25px;
    }
  }
  `,
})
export class StdBtn {
  readonly lyt = inject(LayoutService);

  readonly id          = input.required<ButtonID>();
  readonly innerText   = input<string>("Click!");
  readonly onTrigger   = output<void>();

  constructor(){
    effect(() => {
      if (this.lyt.activeBtn() === this.id())
        this.onTrigger.emit();
    });
  }

}
