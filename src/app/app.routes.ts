import { Routes } from '@angular/router';
import { ModalAvatars } from './components/pop-up/modal/modal-avatars/modal-avatars';
import { ProfileComponent } from './components/pop-up/modal/profile/profile';
import { Files } from './components/pop-up/modal/files/files';
import { Query } from './components/pop-up/modal/query/query';

// Keep in sync with `modals` in types/layout_types.ts.
export const routes: Routes = [
    {
       path: "modal",
       children: [
        { path: "profile", component: ProfileComponent },
        { path: "files",   component: Files },
        { path: "query",   component: Query },
        { path: "avatars", component: ModalAvatars },
       ]
    },
];
