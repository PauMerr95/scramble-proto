import { Component, effect, input, signal, inject, model, output, ViewChild } from '@angular/core';
import { DropDownID, DropDownOption } from '../../../types/util_types';
import { DropDownItem } from './drop-down-item/drop-down-item';
import { LayoutService } from '../../../services/layout-service';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { IconCaretDown } from '../../icons/caret-down';
import { GridInjection } from '../../../types/layout_types';

//  INFO:
//  ===Inputs===
//  * id (also register in DropDownID) REQUIRED
//  * optionList (also register in DropDownOption),
//  ===Outputs===
//  * changedOptions: $(event) = id: number in optionList that reflects new activeOption
//  ===Injections===
//  * LayoutService => needed for even triggers
//

@Component({
  selector: 'app-drop-down',
  imports: [DropDownItem, ScrollingModule, IconCaretDown],
  template: `
  <div class="DD-wrapper">
    <div class="DD-active-option"
    [class.targeted]="this.lyt.currentlyTargeted() === this.id()"
    [class.pseudoactive]="this.lyt.activeDD() === this.id()"
    (click)="toggleList()">
      <span>{{ activeOption() }}</span>
      <app-icon-caret-down
      class="caret-down"
      [class.active]="isOpen()"
      [svg_color]="'#FAF0E6'"></app-icon-caret-down>
    </div>

    @if (isOpen()) {
      <cdk-virtual-scroll-viewport #viewport
      class="viewport"
      itemSize=20
      [style.height]="this.displaySize()*21 + 'px'">
        <div class="option-list">
        @for (opt of this.optionList(); let idx = $index; track $index) {
          <app-drop-down-item
          [optionID]="idx"
          [optionName]="opt"
          [isTargeted]="idx+'_'+this.id()+'_'+opt === this.lyt.currentlyTargeted()"
          [visibleRange]="this.visibleRange()"
          (onClick)="updateActiveOption($event);this.toggleList();"
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
  .DD-wrapper{
    width: calc(100% + 0.5em);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: start;
  }
  .cdk-virtual-scroll-viewport {
    height: 84px;
    width: inherit;
    pointer-events: all;

    &::-webkit-scrollbar {
      width: 1em;
    }
    &::-webkit-scrollbar-track {
      -webkit-box-shadow: inset 0 0 6px var(--color-std-1000, #090f0a);
    }
    &::-webkit-scrollbar-thumb {
      border-radius: 2px;
      background-color: var(--color-std-500, #c2f50a);
    }
  }
  .option-list {
    display: grid;
    grid-auto-columns: auto;

    border-left:  1px solid var(--color-std-200, #e7fb9d);
    border-right: 1px solid var(--color-std-200, #e7fb9d);
  }
  .DD-active-option{
    width: calc(100% - 1em);
    height: 1.6em;
    padding: 2px;
    min-width: 140px;

    display: flex;
    justify-content: space-between;
    padding-left: 10px;
    padding-right: 5px;
    align-items: center;
    border: 1px solid var(--color-std-500, #c2f50a);

    background-color: var(--color-std-900, #273102);
    border-radius: 10px;
    color: var(--color-std-100, #f3fdce);
    line-height: 25px;

    font-weight: 300;
    font-size: 12px;

    user-select: none;
    cursor: pointer;
    touch-action: manipulation;
    pointer-events: all;
  }
  .DD-active-option.targeted {
    box-shadow: 0  3px 10px 0 var(--color-std-600, #9bc408),
                0 -3px 10px 0 var(--color-std-600, #9bc408);
  }
  .DD-active-option:hover {
    background-color: var(--color-std-100, #f3fdce);
    color: var(--color-std-800, #4e6204);
  }
  .DD-active-option.pseudoactive {
    transform: translate(2px, 2px);
  }
  .caret-down{
    display: flex;
    align-items: center;
  }
  .caret-down.active {
    transform: rotate(180deg);
  }
  `,
})
export class DropDown {
  readonly lyt = inject(LayoutService);

  readonly optionList    = input<readonly DropDownOption[]>([]);
  readonly activeOption  = model<string>("Select Option");
  readonly changedOption = output<number>();

  readonly id     = input.required<DropDownID>();
  readonly isOpen = signal<boolean>(false);
  readonly displaySize = input<number>(4);
  readonly visibleRange = signal<[number, number]>([0, this.displaySize()]);

  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;

  constructor(){
    effect(() => {
      const activeDD = this.lyt.activeDD();
      const componentID = this.id();
      if (activeDD === componentID) {
        const new_idx = this.lyt.updateDD();
        if (new_idx !== null) {
          this.updateActiveOption(new_idx);
        }
        this.toggleList();
      }
    });
  }

  toggleList(): void{
    this.isOpen.update(state => !state);
    if(this.isOpen()) {
      console.log("Injecting into grid");
      const injection: GridInjection = {
        insertLoc: (this.id() === this.lyt.currentlyTargeted()) ?
                   structuredClone(this.lyt.selector!) : this.lyt.bruteFind(this.id())!,
        origin: this.id(),
        axis: "row",
        data: this.optionList().map((opt, idx) => `${idx}_${this.id()}_${opt}`)
      };
      this.lyt.injectIntoGrid(injection);
    } else {
      console.log("Ejecting from grid");
      this.lyt.ejectFromGrid(this.id());
    }
  }
  updateActiveOption(id: number){
    this.activeOption.set(this.optionList()[id]);
    this.changedOption.emit(id);
  }

  handleScroll(targetID: number) {
    this.viewport.scrollToIndex(targetID);
    this.visibleRange.set([targetID, (targetID + this.displaySize())]);
  }
}
