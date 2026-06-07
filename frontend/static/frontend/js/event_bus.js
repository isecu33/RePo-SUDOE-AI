// EventBus - Simple event management system for module communication
class EventBus {
    constructor() {
        this.events = {};
    }

    // Subscribe to an event
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    // Unsubscribe from an event
    off(event, callback) {
        if (!this.events[event]) return;

        this.events[event] = this.events[event].filter(cb => cb !== callback);

        // Clean up empty arrays
        if (this.events[event].length === 0) {
            delete this.events[event];
        }
    }

    // Emit an event
    emit(event, data) {
        if (!this.events[event]) return;

        // Create a copy of the callbacks array to avoid issues if callbacks are modified during iteration
        const callbacks = [...this.events[event]];

        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event callback for '${event}':`, error);
            }
        });
    }

    // Remove all listeners for an event
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }

    // Get all registered events (for debugging)
    getEvents() {
        return Object.keys(this.events);
    }

    // Get listener count for an event
    listenerCount(event) {
        return this.events[event] ? this.events[event].length : 0;
    }
}

// Initialize global EventBus instance
window.EventBus = new EventBus();
console.log('EventBus initialized globally');