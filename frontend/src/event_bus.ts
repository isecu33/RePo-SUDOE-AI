// EventBus — Sistema simple de gestión de eventos para comunicación entre módulos
import type { EventCallback } from './types';

export class EventBus {
  private events: Record<string, EventCallback[]> = {};

  /** Suscribirse a un evento */
  on<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback as EventCallback);
  }

  /** Desuscribirse de un evento */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.events[event]) return;

    this.events[event] = this.events[event].filter(
      (cb) => cb !== (callback as EventCallback)
    );

    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }

  /** Emitir un evento con datos opcionales */
  emit<T = unknown>(event: string, data?: T): void {
    if (!this.events[event]) return;

    // Copia del array para evitar problemas si los callbacks se modifican durante la iteración
    const callbacks = [...this.events[event]];

    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error en callback del evento '${event}':`, error);
      }
    });
  }

  /** Eliminar todos los listeners de un evento (o todos si no se especifica) */
  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  /** Obtener todos los eventos registrados (para depuración) */
  getEvents(): string[] {
    return Object.keys(this.events);
  }

  /** Número de listeners para un evento */
  listenerCount(event: string): number {
    return this.events[event] ? this.events[event].length : 0;
  }
}

// Instancia global
const eventBus = new EventBus();
window.EventBus = eventBus;
console.log('EventBus inicializado globalmente.');

export default eventBus;
