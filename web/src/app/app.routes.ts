import { Routes } from '@angular/router';
import { LibraryComponent } from './library/library.component';
import { ReaderComponent } from './reader/reader.component';
import { ScratchpadComponent } from './scratchpad/scratchpad.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  { path: '', component: LibraryComponent },
  { path: 'text', component: ScratchpadComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'books/:id', component: ReaderComponent },
];
