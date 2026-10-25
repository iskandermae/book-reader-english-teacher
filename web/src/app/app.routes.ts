import { Routes } from '@angular/router';
import { LibraryComponent } from './library/library.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  { path: '', component: LibraryComponent },
  { path: 'settings', component: SettingsComponent },
];
