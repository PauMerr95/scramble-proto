import { Component } from '@angular/core';
import { SequenceViewerComponent } from "../sequence-viewer-component/sequence-viewer-component"; 

@Component({
  selector: 'app-main-pane',
  imports: [SequenceViewerComponent],
  templateUrl: './main-pane.html',
  styleUrl: './main-pane.scss',
})
export class MainPane {}
