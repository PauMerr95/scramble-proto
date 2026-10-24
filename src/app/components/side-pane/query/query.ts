import { Component, effect, inject} from '@angular/core';
import { IconQueryGenome } from '../../icons/icon-query-genome';
import { IconQueryGene } from '../../icons/icon-query-gene';
import { IconQueryVirus } from '../../icons/icon-query-virus';
import { IconQueryProkaryot } from '../../icons/icon-query-prokaryot';
import { IconQueryOrganelle } from '../../icons/icon-query-organelle';
import { LayoutService } from '../../../services/layout-service';
import { QueryMainPage } from './query-main-page/query-main-page';
import { QueryGenomePage } from './query-genome-page/query-genome-page';
import { QueryGenePage } from './query-gene-page/query-gene-page';
import { QueryProkaryotPage } from './query-prokaryot-page/query-prokaryot-page';
import { QueryVirusPage } from './query-virus-page/query-virus-page';
import { QueryOrganellePage } from './query-organelle-page/query-organelle-page';
import * as mvgSide from '../../../move-grids/mv-grids-sidePane';

@Component({
  selector: 'app-query',
  imports: [IconQueryGene, IconQueryGenome, IconQueryProkaryot, IconQueryVirus, IconQueryOrganelle,
            QueryGenePage, QueryGenomePage, QueryProkaryotPage, QueryVirusPage, QueryOrganellePage,
            QueryMainPage
   ],
  templateUrl: './query.html',
  styleUrl: './query.scss',
})
export class Query {
  readonly lyt = inject(LayoutService);

  hoverGenome: boolean = false;
  hoverGene: boolean = false;
  hoverProkaryot: boolean = false;
  hoverVirus: boolean = false;
  hoverOrganelle: boolean = false;
  
  constructor() {
    effect(() => {
      if (this.lyt.currentFocus() === "SidePane" 
          && this.lyt.sidePaneState() === "Query") {
        switch (this.lyt.queryPage()) {
          case 'Genome':    this.lyt.loadGrid(mvgSide.queryGenomeGrid);    break;
          case 'Gene':      this.lyt.loadGrid(mvgSide.queryGeneGrid);      break;
          case 'Prokaryot': this.lyt.loadGrid(mvgSide.queryProkaryotGrid); break;
          case 'Virus':     this.lyt.loadGrid(mvgSide.queryVirusGrid);     break; 
          case 'Organelle': this.lyt.loadGrid(mvgSide.queryOrganelleGrid); break;
          case 'QueryMain': this.lyt.loadGrid(mvgSide.queryMainGrid);      break;
        }
      }
    });
  }

}
