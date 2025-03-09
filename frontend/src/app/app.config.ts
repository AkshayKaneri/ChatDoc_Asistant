import { ApplicationConfig } from '@angular/core';
import { provideRouter, Routes, RouterOutlet } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { NamespaceChatComponent } from './components/namespace/namespace-chat.component';
import { GlobalChatComponent } from './components/global-chat/global-chat.component';

export const routes: Routes = [
  { path: '', component: NamespaceChatComponent },
  { path: 'chat', component: GlobalChatComponent },
  { path: '**', redirectTo: '' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient()
  ],

};