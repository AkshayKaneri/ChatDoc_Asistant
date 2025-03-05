import { ApplicationConfig } from '@angular/core';
import { provideRouter, Routes, RouterOutlet } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

// Import your components for routing
import { UploadComponent } from './components/upload/upload.component';

const routes: Routes = [
  { path: '', component: UploadComponent },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient()
  ],

};