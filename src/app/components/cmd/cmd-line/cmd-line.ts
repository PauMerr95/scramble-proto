import { Component } from '@angular/core';
import { CmdOutput } from "../output/output";
import { CmdInput } from "../input/input";

@Component({
  selector: 'app-cmd-line',
  imports: [CmdOutput, CmdInput],
  templateUrl: './cmd-line.html',
  styleUrl: './cmd-line.scss',
})
export class CmdLine {

}
