import { AuthenticationEventSinkPort } from './ports.js';

export class InMemoryAuthenticationEventSink extends AuthenticationEventSinkPort {
  constructor() {
    super();
    this.events = [];
  }

  async record(event) {
    this.events.push(structuredClone(event));
  }

  list() {
    return structuredClone(this.events);
  }
}
