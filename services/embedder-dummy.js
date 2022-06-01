import { EmbedderServiceHandler } from './embedder';

export class EmbedderDummyHandler extends EmbedderServiceHandler {
  constructor({ element, callbacks }) {
    super({ element, serviceName: 'dummy' });

    if (callbacks) {
      this.registerCallbacks(callbacks);
    }
  }

  getInitPayload() {
    return {};
  }
}
