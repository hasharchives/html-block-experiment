import { BlockServiceHandler } from './block';

export class BlockDummyHandler extends BlockServiceHandler {
  constructor({ element, callbacks }) {
    super({ element, serviceName: 'dummy' });
    if (callbacks) {
      this.registerCallbacks(callbacks);
    }
  }

  getRandomNumber() {
    return this.sendMessage({
      message: {
        name: 'getRandomNumber',
        payload: {},
      },
      respondedToBy: 'getRandomNumberResponse',
    });
  }
}
