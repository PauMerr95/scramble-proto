import { Component, computed, signal, inject, viewChild} from '@angular/core';
import { GENOME_QUERY_OPTS, SelectectableQueryBy, RetrieveRoster, SelectectableRetrieve, QueryPacket, SelectableLocation } from '../../../../types/side_types';
import { LayoutService } from '../../../../services/layout-service';
import { StdBtn } from "../../../util/std-btn/std-btn";
import { DropDown } from '../../../util/drop-down/drop-down';
import { InputText } from '../../../util/input-text/input-text';
import { DataSessionService } from '../../../../services/data-session-service';



@Component({
  selector: 'app-query-genome-page',
  imports: [StdBtn, DropDown, InputText],
  templateUrl: './query-genome-page.html',
  styleUrl: './query-genome-page.scss',
})
export class QueryGenomePage {
  readonly queryOptions = GENOME_QUERY_OPTS;
  readonly lyt =  inject(LayoutService);
  readonly data = inject(DataSessionService);
  readonly inputRef = viewChild<InputText>('input');

  readonly firstSelection   = signal<SelectectableQueryBy | null>(null);
  readonly secondSelection  = signal<SelectectableRetrieve | null>(null);

  readonly secondOptions = computed(() => {
    const selection: RetrieveRoster = [
      { value: 'Annotation Report',           compatibleWith: ['Assembly Accession']},
      { value: 'Annotation Data Package',     compatibleWith: ['Assembly Accession']},
      { value: 'Annotation Download Summary', compatibleWith: ['Assembly Accession']},
      { value: 'Annotation Report Summary',   compatibleWith: ['Assembly Accession']},
      { value: 'Data Package',                compatibleWith: ['Assembly Accession']},
      { value: 'Download Summary',            compatibleWith: ['Assembly Accession']},
      { value: 'Revision History',            compatibleWith: ['Assembly Accession']},
      { value: 'Sequence Report',             compatibleWith: ['Assembly Accession']},
      { value: 'Assembly Report',             compatibleWith: ['Assembly Accession',
                                                               'Assembly Name',
                                                               'BioProject Accession',
                                                               'BioSample Accession',
                                                               'Species Taxon',
                                                               'WGS Accession']},
      { value: 'Assembly Accession',          compatibleWith: ['Nucleotide Accession']},
      { value: 'CheckM Histogramm',           compatibleWith: ['Species Taxon']},
    ];
    if (this.firstSelection() === null) return null
    const filteredSelection = selection.filter(opt => opt.compatibleWith.includes(this.firstSelection() as SelectectableQueryBy));
    const options: SelectectableRetrieve[] = [];
    filteredSelection.forEach(rosterItem => options.push(rosterItem.value));
    return options;
  });

  readonly helpFirstSelection = computed(() => {
    const mapHelp = new Map<SelectectableQueryBy, string>([
      ["Assembly Accession",
        "GCF_000001635.27"],
      ["Nucleotide Accession",
        "NC_000001.11"],
      ["Assembly Name",
        "mCamDro1.pat"],
      ["BioProject Accession",
        "PRJNA31257"],
      ["BioSample Accession",
        "SAMN15960293"],
      ["Species Taxon",
        "9606"],
      ["WGS Accession",
        "JAXUCZ01"],
    ]);
    if (this.firstSelection() === null) return null;
    return mapHelp.get(this.firstSelection() as SelectectableQueryBy);
  });

  readonly helpSecondSelection = computed(() => {
    const mapHelp = new Map<SelectectableRetrieve, string>([
      ["Annotation Report",
        "Retrieves a list of annotation reports corresponding to the query parameters"],
      ["Annotation Data Package",
        "Retrieves a list of annotation reports and sequences corresponding to the query parameters"],
      ["Annotation Download Summary",
        "Retrieves a preview for the annotation package corresponding to the query parameters"],
      ["Annotation Report Summary",
        "Retrieves a preview for the annotation reports corresponding to the query parameters"],
      ["Revision History",
        "Retrieves a revision history or list for all versions of the corresponding query"],
      ["Sequence Report",
        "Retrieves a sequence report for the corresponding query"],
      ["Assembly Report",
        "Retrieves a assembly report for the corresponding query"],
      ["Data Package",
        "Retrieves a assembly report including sequences and annotations for the corresponding query"],
      ["Download Summary",
        "Retrieves a preview for a data package, including count and filesize"],
      ["Assembly Accession",
        "Retrieves a genome assembly accession ID for the corresponding query"],
      ["CheckM Histogramm",
        "Retrieves CheckM histogram data by species taxon. This data is used for rendering CheckM histograms on bacterial genome pages"],
    ]);
    if (this.secondSelection() === null) return null;
    return mapHelp.get(this.secondSelection()! as SelectectableRetrieve);
  });

  generateAndLogURL(){
    if (this.inputRef() === undefined) {
      this.lyt.notify({kind: 'Error', message: "Undefined Input Reference"});
      return;
    }
    if (this.inputRef()!.value() === null) {
      this.lyt.notify({kind: 'Warn', message: "Did not provide any query specifier (e.g. Accession ID)"});
      return;
    }
    const query: QueryPacket = {
      how: this.firstSelection()!,      // Button only displayed when not null
      what: this.secondSelection()!,    // Button only displayed when not null
      specifier: this.inputRef()!.value()!  // Can be any crap the user enters
    };
    console.log(`Generated the following string:\n${this.data.getFromQuery(query)}`);
  }

  handleChangeDDOption1(newID: number) {
    this.firstSelection.set(this.queryOptions[newID]);
    this.secondSelection.set(null);
    this.lyt.updateGrid(grid => {
      console.log(`Running updateGrid on ${grid}`);
      if (grid!.length < (3 + this.queryOptions.length)) {
        grid!.push(["QueryInputGenome"     as SelectableLocation]);
        grid!.push(["QueryDDGenomeOption2" as SelectableLocation]);
      }
      return grid;
    })
  }
  handleChangeDDOption2(newID: number) {
    this.secondSelection.set(this.secondOptions()![newID]);
    this.lyt.updateGrid(grid => {
      grid!.push(["RetrieveGenomeBtn"]);
      return grid;
    });
  }
}
