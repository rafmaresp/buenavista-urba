import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatosMapa, Estado, Incidencia, NuevaIncidencia } from './modelos';

interface AuthMe { clientPrincipal: { userRoles?: string[] } | null; }

@Injectable({ providedIn: 'root' })
export class IncidenciasApi {
  private readonly http = inject(HttpClient);

  datosMapa() { return firstValueFrom(this.http.get<DatosMapa>('/datos/buenavista.json')); }

  listar() { return firstValueFrom(this.http.get<Incidencia[]>('/api/incidencias')); }
  crear(n: NuevaIncidencia) { return firstValueFrom(this.http.post<Incidencia>('/api/incidencias', n)); }
  apoyar(id: string) { return firstValueFrom(this.http.post<Incidencia>(`/api/incidencias/${encodeURIComponent(id)}/apoyos`, {})); }

  listarGestion() { return firstValueFrom(this.http.get<Incidencia[]>('/api/gestion/incidencias')); }
  cambiarEstado(id: string, estado: Estado) {
    return firstValueFrom(this.http.patch<Incidencia>(`/api/gestion/incidencias/${encodeURIComponent(id)}`, { estado }));
  }

  /** SWA expone /.auth/me. Fuera de SWA (ng serve) falla y se trata como no admin. */
  async esAdmin(): Promise<boolean> {
    try {
      const me = await firstValueFrom(this.http.get<AuthMe>('/.auth/me'));
      return me.clientPrincipal?.userRoles?.includes('admin') ?? false;
    } catch {
      return false;
    }
  }
}
