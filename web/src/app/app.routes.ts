import { Routes } from '@angular/router';
import { Inicio } from './inicio/inicio';

export const routes: Routes = [
  { path: '', component: Inicio },
  // Perezosas: el código de login (y GIS) no se descarga fuera de /login.
  { path: 'login', loadComponent: () => import('./login/login').then((m) => m.Login) },
  { path: 'usuarios', loadComponent: () => import('./usuarios/usuarios').then((m) => m.Usuarios) },
  { path: 'privacidad', loadComponent: () => import('./privacidad/privacidad').then((m) => m.Privacidad) },
  { path: '**', redirectTo: '' },
];
