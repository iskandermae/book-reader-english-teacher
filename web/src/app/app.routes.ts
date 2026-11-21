import { Routes } from '@angular/router';
import { AudioComponent } from './audio/audio.component';
import { LibraryComponent } from './library/library.component';
import { LlmLogComponent } from './llm-log/llm-log.component';
import { ReaderComponent } from './reader/reader.component';
import { ScratchpadComponent } from './scratchpad/scratchpad.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  { path: '', component: LibraryComponent },
  { path: 'text', component: ScratchpadComponent },
  { path: 'llm-log', component: LlmLogComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'books/:id/audio', component: AudioComponent },
  { path: 'books/:id', component: ReaderComponent },
];
