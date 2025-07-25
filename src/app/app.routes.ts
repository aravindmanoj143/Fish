import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';

import { FileManagerComponent } from './file-manager/file-manager.component';

export const routes: Routes = [
//      { path: '', component: LoginComponent },
//      { path: 'login', component: LoginComponent },
//       { path: 'filemgr', component: FileManagerComponent, canActivate: [AuthGuard] },
//       { path: '**', redirectTo: 'login', pathMatch: 'full' } // default route
    { path: '', component: FileManagerComponent },
 
      { path: 'filemgr', component: FileManagerComponent},

   
];
