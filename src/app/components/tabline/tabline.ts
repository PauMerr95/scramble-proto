import { afterRenderEffect, Component, computed, ElementRef, inject, viewChildren } from '@angular/core';
import { DataSessionService } from '../../services/data-session-service';
import { PaneService } from '../../services/pane-service';
import { CmdLineService } from '../../services/cmd-line-service';
import { RecordMeta } from '../../types/main_types';

export const TAB_LABEL_CHARS = 12;

export interface Tab {
  number: number;         // 1-based, as used by <leader>{number}t and :tab
  rec: RecordMeta;
  label: string;
  closeTitle: string;
  shown: boolean;         // shown in any pane
  active: boolean;        // shown in the active pane
}

/** One tab per open record, shared by all panes. Clicking one shows it in the active pane. */
@Component({
  selector: 'app-tabline',
  templateUrl: './tabline.html',
  styleUrl: './tabline.scss',
})
export class Tabline {
  private readonly data  = inject(DataSessionService);
  private readonly panes = inject(PaneService);
  readonly cli = inject(CmdLineService);

  private readonly tabEls = viewChildren<ElementRef<HTMLElement>>('tab');

  readonly tabs = computed<Tab[]>(() => {
    const recs   = this.data.records();
    const shown  = this.panes.shownRecordIds();
    const active = this.panes.activeViewer().activeRecord()?.id;
    return recs.map((rec, i) => ({
      number: i + 1,
      rec,
      label: tabLabel(rec),
      closeTitle: closeTitle(rec, recs.filter(r => r.fileId === rec.fileId).length),
      shown: shown.has(rec.id),
      active: rec.id === active,
    }));
  });

  constructor() {
    // Tabs scroll horizontally: keep the active one in view.
    afterRenderEffect(() => {
      const idx = this.tabs().findIndex(tab => tab.active);
      this.tabEls()[idx]?.nativeElement.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
  }
}

/** The first TAB_LABEL_CHARS characters of the header, "…" if cut. */
export function tabLabel(rec: RecordMeta): string {
  const name = rec.header || rec.id;
  return (name.length > TAB_LABEL_CHARS) ? name.slice(0, TAB_LABEL_CHARS) + '…' : name;
}

function closeTitle(rec: RecordMeta, recordsInFile: number): string {
  const file = rec.source ?? 'this file';
  return (recordsInFile > 1) ? `Close ${file} (${recordsInFile} records), like :q` : `Close ${file}, like :q`;
}
