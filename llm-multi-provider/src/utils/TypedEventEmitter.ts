export type Listener = (...args: any[]) => void;

/**
 * Lightweight, zero-dependency typed event emitter compatible across Node.js, Next.js, and browser runtimes.
 */
export class TypedEventEmitter<Events extends Record<string, any>> {
  private listeners: Map<keyof Events, Set<Listener>> = new Map();

  on<K extends keyof Events>(event: K, listener: Events[K]): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener);
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Events[K]): this {
    const wrapper = ((...args: any[]) => {
      this.off(event, wrapper as any);
      (listener as Listener)(...args);
    }) as Listener;
    return this.on(event, wrapper as any);
  }

  off<K extends keyof Events>(event: K, listener: Events[K]): this {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const listener of Array.from(set)) {
      try {
        listener(...args);
      } catch (err) {
        console.error(`Error in event listener for "${String(event)}":`, err);
      }
    }
    return true;
  }

  removeAllListeners<K extends keyof Events>(event?: K): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size || 0;
  }
}
