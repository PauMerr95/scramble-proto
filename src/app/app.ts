import { Component, signal, inject, HostListener } from '@angular/core';
import { Navbar } from "./components/navbar/navbar";
import { MainPane } from "./components/main-pane/main-pane";
import { Statusbar } from "./components/statusbar/statusbar";
import { LayoutService } from './services/layout-service';
import { Notification } from "./components/pop-up/notification/notification";
import { Modal } from "./components/pop-up/modal/modal";
import { CmdModal } from "./components/pop-up/cmd-modal/cmd-modal";
import { MotionService } from './services/motion-service';

@Component({
  selector: 'app-root',
  imports: [Navbar, Statusbar, MainPane, Notification, Modal, CmdModal],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title  = signal('scramble');
  protected readonly lyt    = inject(LayoutService);
  protected readonly motion = inject(MotionService)

  @HostListener('keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    this.motion.handleKeyDown(e);
  }

}
