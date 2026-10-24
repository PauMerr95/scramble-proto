import { Component, inject } from '@angular/core';
import { LayoutService } from '../../../../services/layout-service';
import { StdBtn } from '../../../util/std-btn/std-btn';

@Component({
  selector: 'app-query-main-page',
  imports: [StdBtn],
  templateUrl: './query-main-page.html',
  styleUrl: './query-main-page.scss',
})
export class QueryMainPage {
  readonly lyt = inject(LayoutService);
}
