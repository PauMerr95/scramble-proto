import { Component, signal, inject, HostListener } from '@angular/core';
import { Navbar } from "./components/navbar/navbar";
import { SidePane } from "./components/side-pane/side-pane";
import { MainPane } from "./components/main-pane/main-pane";
import { Statusbar } from "./components/statusbar/statusbar";
import { EditorMode } from './types/main_types';
import { CmdLine } from "./components/cmd/cmd-line/cmd-line";
import { LayoutService } from './services/layout-service';
import { Notification } from "./components/pop-up/notification/notification";
import { Modal } from "./components/pop-up/modal/modal";
import { MotionService } from './services/motion-service';

@Component({
  selector: 'app-root',
  imports: [Navbar, SidePane, Statusbar, MainPane, CmdLine, Notification, Modal],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title  = signal('scramble');
  protected readonly lyt    = inject(LayoutService);
  protected readonly motion = inject(MotionService)

  activeMode: EditorMode = "Normal";

  switchMode(mode: EditorMode) {
    this.activeMode = mode;
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    this.motion.handleKeyDown(e);
  }

}
