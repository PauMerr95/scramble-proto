import { Component, signal, inject, effect, Signal } from '@angular/core';
import { CmdLineService } from '../../../services/cmd-line-service';
import { CmdOutputType } from '../../../types/cmd_types';

@Component({
  selector: 'app-output',
  imports: [],
  template: ` <span [class]="outputFormat()">{{outputText()}}</span> `,
  styles: `
    .Failure {
      color: #FF6969;
    }
    .Neutral {
      color: inherit;
    }
    .Success {
      color: #55dc48;
    }
  `,
})
export class CmdOutput {
  protected readonly cli = inject(CmdLineService);

  readonly outputText: Signal<string> = this.cli.cmdOutput;
  readonly outputFormat: Signal<CmdOutputType> = this.cli.cmdOutputType;

}
