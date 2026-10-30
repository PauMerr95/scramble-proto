import { Routes } from '@angular/router';
import { Settings } from './components/pop-up/modal/settings/settings';
import { Files } from './components/pop-up/modal/files/files';
import { Query } from './components/pop-up/modal/query/query';

// Keep in sync with `modals` in types/layout_types.ts.
export const routes: Routes = [
    {
       path: "modal",
       children: [
        { path: "settings", component: Settings },
        { path: "files",   component: Files },
        { path: "query",   component: Query },
       ]
    },
];
