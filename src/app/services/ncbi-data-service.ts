import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { QueryPacket, SelectectableQueryBy, SelectectableRetrieve } from '../types/side_types';

const apiDatasetsV2 = "https://api.ncbi.nlm.nih.gov/datasets/v2/";

const howExtension = new Map<SelectectableQueryBy, string>([
    ["Assembly Accession"  , 'genome/accession/'],
    ["Nucleotide Accession", 'genome/sequence_accession/'], // can only work with retrieving Assembly Accession
    ["Assembly Name"       , 'genome/assembly_name/'],      // can only work with retrieving Assembly Report
    ["BioProject Accession", 'genome/bioproject/'],         // can only work with retrieving Assembly Report
    ["BioSample Accession" , 'genome/biosample/'],          // can only work with retrieving Assembly Report
    ["Species Taxon"       , 'genome/taxon/'],
    ["WGS Accession"       , 'genome/wgs/']
]);
const whatExtension = new Map<SelectectableRetrieve, string>([
  ["Annotation Report"          , 'annotation_report'],
  ["Annotation Data Package"    , 'annotation_report/download'],
  ["Annotation Download Summary", 'annotation_report/download_summary'],
  ["Annotation Report Summary"  , 'annotation_summary'],
  ["Revision History"           , 'revision_history'],
  ["Sequence Report"            , 'sequence_reports'],
  ["Assembly Report"            , 'dataset_report'],
  ["Data Package"               , 'download'],
  ["Download Summary"           , 'download_summary'],
  ["Assembly Accession"         , 'sequence_assemblies'],
  ["CheckM Histogramm"          , 'checkm_histogram']
]);

@Injectable({
  providedIn: 'root',
})
export class NCBIDataService {
  // private http = inject(HttpClient);

  /*
   *getGenome(kind: SelectectableRetrieve, by: SelectectableQueryBy, byInput: string) {
   *  this.http.get()
   *}
   */

  createUrl(q: QueryPacket): string {
    return apiDatasetsV2
         + howExtension.get(q.how)
         + ((q.specifier) ? q.specifier + '/' : '')
         + whatExtension.get(q.what)
  }
}
