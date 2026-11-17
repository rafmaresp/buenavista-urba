import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Sesion } from '../sesion';
import {
  ErrorUsuarios,
  type MotivoErrorUsuarios,
  type RolUsuario,
  type UsuarioGestion,
  altaUsuario,
  cambiarUsuario,
  listarUsuarios,
} from './usuarios-cliente';

const MENSAJES: Record<MotivoErrorUsuarios, string> = {
  'sin-acceso': 'Tu sesión ha caducado o ya no tienes permiso. Vuelve a entrar.',
  'no-valido': 'Revisa el correo y el rol.',
  'ya-existe': 'Ese correo ya está en la lista. Si está de baja, reactívalo.',
  'propio-usuario': 'No puedes cambiar tu propio rol ni darte de baja. Pídeselo a otra persona de la directiva.',
  'usuario-cambiado': 'Otra persona ha cambiado este usuario. Se ha recargado la lista; inténtalo de nuevo.',
  'no-encontrado': 'Ese usuario ya no está en la lista. Se ha recargado.',
  'no-disponible': 'No se ha podido completar. Inténtalo dentro de un rato.',
};

/** Ruta /usuarios (spec 009-gestion-usuarios): la directiva gestiona la lista cerrada. */
@Component({
  selector: 'app-usuarios',
  imports: [RouterLink],
  templateUrl: './usuarios.html',
})
export class Usuarios implements OnInit {
  protected readonly sesion = inject(Sesion);
  protected readonly usuarios = signal<UsuarioGestion[] | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  protected readonly email = signal('');
  protected readonly rol = signal<RolUsuario>('comunero');

  private readonly llamar = (url: string, init?: RequestInit) => this.sesion.llamar(url, init);

  async ngOnInit(): Promise<void> {
    if (this.sesion.rol() === 'directiva') await this.cargar();
  }

  protected async cargar(): Promise<void> {
    try {
      this.usuarios.set(await listarUsuarios(this.llamar));
    } catch (e) {
      this.error(e);
    }
  }

  protected async darDeAlta(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.ocupado() || !this.email().trim()) return;
    await this.hacer(async () => {
      const nuevo = await altaUsuario(this.llamar, this.email(), this.rol());
      this.email.set('');
      this.rol.set('comunero');
      this.aviso.set({ tipo: 'ok', texto: `${nuevo.email} ya puede entrar como ${nuevo.rol}.` });
    });
  }

  protected async cambiarRol(u: UsuarioGestion, rol: string): Promise<void> {
    if (rol !== 'comunero' && rol !== 'directiva') return;
    await this.hacer(async () => {
      const cambiado = await cambiarUsuario(this.llamar, u.uid, { rol });
      this.aviso.set({ tipo: 'ok', texto: `${cambiado.email} ahora es ${cambiado.rol}.` });
    });
  }

  protected async cambiarEstado(u: UsuarioGestion): Promise<void> {
    const estado = u.estado === 'activo' ? 'baja' : 'activo';
    await this.hacer(async () => {
      const cambiado = await cambiarUsuario(this.llamar, u.uid, { estado });
      this.aviso.set({
        tipo: 'ok',
        texto: estado === 'baja' ? `${cambiado.email} se ha dado de baja.` : `${cambiado.email} se ha reactivado.`,
      });
    });
  }

  /** Ejecuta una escritura y siempre recarga la lista, para que lo que se ve sea lo que hay. */
  private async hacer(accion: () => Promise<void>): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set(null);
    try {
      await accion();
    } catch (e) {
      this.error(e);
    }
    await this.cargarSinBorrarAviso();
    this.ocupado.set(false);
  }

  private async cargarSinBorrarAviso(): Promise<void> {
    try {
      this.usuarios.set(await listarUsuarios(this.llamar));
    } catch {
      // El aviso de la acción ya explica lo ocurrido; la lista se queda como estaba.
    }
  }

  private error(e: unknown): void {
    const motivo = e instanceof ErrorUsuarios ? e.motivo : 'no-disponible';
    this.aviso.set({ tipo: 'error', texto: MENSAJES[motivo] });
  }

  protected entradaEmail(evento: Event): void {
    this.email.set((evento.target as HTMLInputElement).value);
  }

  protected entradaRol(evento: Event): void {
    this.rol.set((evento.target as HTMLSelectElement).value as RolUsuario);
  }

  protected valor(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }
}
