import { Component, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-query-gene-page',
  imports: [],
  templateUrl: './query-gene-page.html',
  styleUrl: './query-gene-page.scss',
})
export class QueryGenePage {
  readonly message = signal<string>("");
  
  getData(path: string) {
    invoke<ArrayBuffer>('get_dna', { path: path})
      .then((msg) => {
        const data = new TextDecoder('utf-8').decode(msg); 
        this.message.set(data);
      })
      .catch((err: string) => {
        this.message.set("ERROR: " + err);
      });
  }
}
