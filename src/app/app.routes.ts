import { Routes } from '@angular/router';
import { ModalAvatars } from './components/pop-up/modal/modal-avatars/modal-avatars';

export const routes: Routes = [
    {
       path: "modal",
       children: [
        { path: "avatars", component: ModalAvatars },
       ]
    },
];
