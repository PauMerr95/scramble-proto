import { Component, inject, ElementRef, input, viewChild } from '@angular/core';
import { ActiveNotification } from '../../../types/layout_types';
import { LayoutService } from '../../../services/layout-service';

@Component({
  selector: 'app-notification',
  imports: [],
  templateUrl: './notification.html',
  styleUrl: './notification.scss',
})
export class Notification {
  readonly lyt = inject(LayoutService);
  readonly notification = input.required<ActiveNotification>();
  readonly elRef = viewChild.required<ElementRef<HTMLDivElement>>('notification')

  private _timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this._timer = setTimeout(this.dismiss, 5000);
  }
  ngOnDestroy() {
    if (this._timer) clearTimeout(this._timer);
  }
  dismiss = () => {
    const el = this.elRef().nativeElement;
    el.classList.add('animation-exiting');
    el.addEventListener('animationend', () => {
      this.lyt.dismissNotification(this.notification().id);
    }, { once: true});
  }

}
