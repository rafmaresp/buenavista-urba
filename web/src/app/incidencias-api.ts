import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GoogleAuth } from './google-auth';
import { DatosMapa, Estado, Incidencia, NuevaIncidencia } from './modelos';

@Injectable({ providedIn: 'root' })
export class IncidenciasApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(GoogleAuth);

  /** La API valida este ID token de Google (cabecera propia para que SWA no la toque). */
  private cabeceras() {
    return { headers: new HttpHeaders({ 'X-Urba-Token': this.auth.token() ?? '' }) };
  }

  config() { return firstValueFrom(this.http.get<{ googleClientId: string | null }>('/api/config')); }

  datosMapa() { return firstValueFrom(this.http.get<DatosMapa>('/datos/buenavista.json')); }

  listar() { return firstValueFrom(this.http.get<Incidencia[]>('/api/incidencias')); }
  crear(n: NuevaIncidencia) { return firstValueFrom(this.http.post<Incidencia>('/api/incidencias', n)); }
  apoyar(id: string) { return firstValueFrom(this.http.post<Incidencia>(`/api/incidencias/${encodeURIComponent(id)}/apoyos`, {})); }

  listarGestion() { return firstValueFrom(this.http.get<Incidencia[]>('/api/gestion/incidencias', this.cabeceras())); }
  cambiarEstado(id: string, estado: Estado) {
    return firstValueFrom(
      this.http.patch<Incidencia>(`/api/gestion/incidencias/${encodeURIComponent(id)}`, { estado }, this.cabeceras()),
    );
  }
}
