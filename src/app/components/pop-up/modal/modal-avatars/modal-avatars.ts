import { Component, inject, effect } from '@angular/core';
import { LayoutService } from '../../../../services/layout-service';
import { avatars, Avatar } from '../../../../types/side_types';
import { AvatarBird } from '../profile/avatars/bird/bird';
import { AvatarDuck } from '../profile/avatars/duck/duck';
import { AvatarEarth } from '../profile/avatars/earth/earth';
import { AvatarFalling } from '../profile/avatars/falling/falling';
import { AvatarSheep } from '../profile/avatars/sheep/sheep';
import { AvatarSquirrel } from '../profile/avatars/squirrel/squirrel';
import { modalAvatarGrid } from '../../../../move-grids/mv-grids-modals';
import { UserDataService } from '../../../../services/user-data';

@Component({
  selector: 'app-modal-avatars',
  imports: [ AvatarBird, AvatarDuck, AvatarEarth, AvatarFalling, AvatarSheep, AvatarSquirrel],
  templateUrl: './modal-avatars.html',
  styleUrl: './modal-avatars.scss',
})
export class ModalAvatars {
  readonly lyt = inject(LayoutService);
  readonly user = inject(UserDataService);
  readonly avatars = avatars;

  select(avatar: Avatar) {
    this.user.updateUserInfo({avatar: avatar});
    this.lyt.closeModal(); 
  }

  ngOnInit(){
    if(this.lyt.currentFocus() === "Modal") {
      this.lyt.loadGrid(modalAvatarGrid);
      console.log(this.lyt.dbg());
    }
  }
  ngOnDestroy() {
    this.lyt.unloadGrid();
  }
}
