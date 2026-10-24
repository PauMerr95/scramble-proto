import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconFolder } from "../icons/folder";
import { IconSearchDB } from "../icons/db_search";
import { IconProfile } from "../icons/profile";
import { NavbarLocation } from '../../types/layout_types';
import { Color } from "../../types/main_types"

@Component({
  selector: 'app-navbar',
  imports: [IconFolder, IconSearchDB, IconProfile],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  @Output() toggleSidePane = new EventEmitter<NavbarLocation>();
  @Input() activeIcon: NavbarLocation | "hidden" = "hidden";

  handleSvgColor(icon: NavbarLocation): Color {
    if (icon === this.activeIcon) return '#000000';
    return '#FAF0E6'; 
  }
}