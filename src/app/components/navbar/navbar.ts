import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconFolder } from "../icons/folder";
import { IconSearchDB } from "../icons/db_search";
import { IconSettings } from "../icons/icon-settings";
import { NavbarLocation, ModalTitle } from '../../types/layout_types';
import { Color } from "../../types/main_types"

@Component({
  selector: 'app-navbar',
  imports: [IconFolder, IconSearchDB, IconSettings],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  @Output() toggleModal = new EventEmitter<NavbarLocation>();
  @Input() activeIcon: ModalTitle | null = null;

  handleSvgColor(icon: NavbarLocation): Color {
    if (icon === this.activeIcon) return '#000000';
    return '#FAF0E6'; 
  }
}