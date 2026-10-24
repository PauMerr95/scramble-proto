import { Component, input, effect, signal, inject, computed,
         ViewChild, viewChild, ElementRef, Output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { DropDownItem } from '../drop-down/drop-down-item/drop-down-item';
import { InputID } from '../../../types/util_types';
import { LayoutService } from '../../../services/layout-service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged  } from 'rxjs';



@Component({
  selector: 'app-input-text',
  imports: [ScrollingModule, DropDownItem, ReactiveFormsModule],
  template: `
  <div class="input-wrapper">
      <input #input type="text"
      [formControl]="inputValueControl"
      [class.targeted]="this.lyt.currentlyTargeted() === this.id()"/>

    @if (isOpen()) {
      <cdk-virtual-scroll-viewport #viewport
      class="viewport"
      itemSize=20
      [style.height]="this.displaySize()*21 + 'px'">
        <div class="recommendation-list">
        @for (rec of this.renderedRecs(); let idx = $index; track $index) {
          <app-drop-down-item
          class="recommentation"
          [optionID]="idx"
          [optionName]="rec"
          [isTargeted]="idx+'_'+this.id()+'_'+rec === this.lyt.currentlyTargeted()"
          [visibleRange]="this.visibleRange()"
          (onClick)="this.chooseRec($event)"
          (scrollToItem)="handleScroll($event)">
          </app-drop-down-item>
        }
        </div>
      </cdk-virtual-scroll-viewport>

    }
  </div>
  `,
  styles: `
  :host{
    display: inline-flex;
    justify-content: stretch;
  }
  .input-wrapper{
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: start;
  }
  .cdk-virtual-scroll-viewport {
    height: 84px;
    width: 100%;
    pointer-events: all;

    &::-webkit-scrollbar {
      width: 0.8em;
    }
    &::-webkit-scrollbar-track {
      -webkit-box-shadow: inset 0 0 6px var(--color-std-1000, #090f0a);
    }
    &::-webkit-scrollbar-thumb {
      border-radius: 2px;
      background-color: var(--color-std-500, #c2f50a);
    }
  }
  input {
    height: 1.6em;
    padding: 2px;

    display: flex;
    justify-content: space-between;
    padding-left: 10px;
    padding-right: 5px;
    align-items: center;
    border: 2px solid var(--color-std-600, #9bc408);

    background-color: var(--color-std-100, #f3fdce);
    border-radius: 5px;
    color: var(--color-std-900, #1b2201);
    line-height: 25px;

    font-family: "Shantell Sans", "Comic Sans", cursive;
    font-weight: bold;
    font-size: 12px;

    user-select: none;
    cursor: pointer;
    touch-action: manipulation;
    pointer-events: all;

  }
  input:hover{
    background-color: var(--color-std-500, #c2f50a);
  }
  input.targeted {
    box-shadow: 0  3px 10px 0 var(--color-std-600, #9bc408),
                0 -3px 10px 0 var(--color-std-600, #9bc408);
  }
  .recommandation-list{
    display: grid;
    grid-auto-columns: auto;

    border-left:  1px solid var(--color-std-1000, #090f0a);
    border-right: 1px solid var(--color-std-1000, #090f0a);
  }
  `,
})
export class InputText {
  inputValueControl = new FormControl<string | null>(null);

  readonly id = input.required<InputID>();
  readonly value = toSignal(
    this.inputValueControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ), { initialValue: null }
  );

  readonly recommendations = input<string[]>([]);
  readonly displaySize     = input<number>(6);

  readonly renderedRecs    = computed<string[]>(() => {
    if (this.value()
     && this.lyt.activeInput() === this.id())
      return this.getRecsFromTree(this.value()!);
    return [];
  });


  readonly isOpen = computed(() => {
    return this.renderedRecs().length > 0;
  });

  readonly lyt = inject(LayoutService);
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly visibleRange = signal<[number, number]>([
    0, Math.min(this.displaySize(), this.renderedRecs().length)
  ]);

  private _recommendationTree: string[] = [];


  constructor() {
    effect(() => {
      if (this.lyt.activeInput() === this.id()) {
        this.inputRef()?.nativeElement.focus();
      }
    });
  }

  ngAfterViewInit() {
    const recs = this.recommendations();
    this._recommendationTree = this.buildRecommendationTree(recs);

    this.inputRef()!.nativeElement.addEventListener('click', () => {
      console.log(`Click Event on ${this.id()} triggered`);
      if (this.lyt.currentlyTargeted() !== this.id()) {
        this.lyt.focusOn("InputElement");
        this.lyt.jumpToID(this.id());
      }
    })
  }

  buildRecommendationTree(rec: string[]): string[] {
    //INFO: Placeholder...
    return rec;
  }

  getRecsFromTree(q: string | null): string[] {
    //INFO: Placeholder...
    if (q && q.length > 2)
      return this._recommendationTree.filter(rec => rec.startsWith(q) && rec !== q);
    return [];
  }

  chooseRec(idx: number){
    this.inputValueControl.setValue(this.renderedRecs()[idx]);
  }

  handleScroll(targetID: number) {
    this.viewport.scrollToIndex(targetID);
    this.visibleRange.set([
      targetID, (targetID + Math.min(this.displaySize(), this.renderedRecs().length - targetID))
    ]);
  }
}


