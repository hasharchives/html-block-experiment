export class BlockServiceHandler {
  constructor({ element, serviceName }) {
    this.element = element !== null && element !== void 0 ? element : null;
    this.serviceName = serviceName;
    this.coreHandler = BlockCoreHandler.registerService({
      element: element !== null && element !== void 0 ? element : null,
      service: this,
    });
  }
  registerCallbacks(callbacks) {
    for (const [messageName, callback] of Object.entries(callbacks)) {
      this.registerCallback({ messageName, callback });
    }
  }
  registerCallback({ messageName, callback }) {
    this.coreHandler.registerCallback({
      callback,
      messageName,
      serviceName: this.serviceName,
    });
  }
  sendMessage(args) {
    if ('respondedToBy' in args && args.respondedToBy) {
      return this.coreHandler.sendMessage({
        partialMessage: args.message,
        respondedToBy: args.respondedToBy,
        sender: this,
      });
    }
    return this.coreHandler.sendMessage({
      partialMessage: args.message,
      sender: this,
    });
  }
}
export class BlockCoreHandler {
  constructor({ callbacks, defaultMessageCallback, element }) {
    this.serviceName = 'core';
    this.defaultMessageCallback = defaultMessageCallback;
    this.settlersForMessagesAwaitingResponse = new Map();
    this.messageCallbacksByService =
      callbacks !== null && callbacks !== void 0 ? callbacks : {};
    this.services = new Map();
    if (element) {
      this.element = element;
      element.addEventListener(BlockCoreHandler.customEventName, (event) => {
        void this.processReceivedMessage(event);
      });
    } else if (window.top === window.self || !window.opener) {
      throw new Error(
        'You must provide an element to initialize a block if the block is not sandboxed. Either provide an element, or load the block in a sandbox.'
      );
    } else {
      window.opener.addEventListener('message', this.processReceivedMessage);
    }
    BlockCoreHandler.coreHandlerMap.set(element, this);
    this.initialize();
  }
  static registerService({ element, service }) {
    var _a, _b;
    var _c;
    const { serviceName } = service;
    const handler =
      (_a = this.coreHandlerMap.get(element)) !== null && _a !== void 0
        ? _a
        : new BlockCoreHandler({ element });
    handler.services.set(serviceName, service);
    (_b = (_c = handler.messageCallbacksByService)[serviceName]) !== null &&
    _b !== void 0
      ? _b
      : (_c[serviceName] = {});
    return handler;
  }
  static unregisterService(element) {
    // @todo
  }
  static isBlockProtocolMessage(message) {
    if (
      typeof message !== 'object' ||
      message === null ||
      Array.isArray(message)
    ) {
      return false;
    }
    if (
      !('requestId' in message) ||
      !('service' in message) ||
      !('source' in message) ||
      !('name' in message)
    ) {
      return false;
    }
    return true;
  }
  initialize() {
    void this.sendMessage({
      partialMessage: { name: 'init' },
      respondedToBy: 'initResponse',
      sender: this,
    });
  }
  registerCallback({ callback, messageName, serviceName }) {
    var _a;
    var _b;
    (_a = (_b = this.messageCallbacksByService)[serviceName]) !== null &&
    _a !== void 0
      ? _a
      : (_b[serviceName] = {});
    this.messageCallbacksByService[serviceName][messageName] = callback;
  }
  sendMessage(args) {
    const { partialMessage, requestId, sender } = args;
    if (!sender.serviceName) {
      throw new Error('Message sender has no serviceName set.');
    }
    const fullMessage = Object.assign(Object.assign({}, partialMessage), {
      requestId:
        requestId !== null && requestId !== void 0 ? requestId : uuid(),
      respondedToBy: 'respondedToBy' in args ? args.respondedToBy : undefined,
      service: sender.serviceName,
      source: 'block',
    });
    if (this.element) {
      const event = new CustomEvent(BlockCoreHandler.customEventName, {
        bubbles: true,
        composed: true,
        detail: fullMessage,
      });
      this.element.dispatchEvent(event);
    } else {
      window.opener.postMessage(
        {
          detail: fullMessage,
          type: BlockCoreHandler.customEventName,
        },
        '*'
      );
    }
    if ('respondedToBy' in args && args.respondedToBy) {
      let resolveToStore = undefined;
      let rejectToStore = undefined;
      const promise = new Promise((resolve, reject) => {
        resolveToStore = resolve; // @todo fix these casts
        rejectToStore = reject;
      });
      this.settlersForMessagesAwaitingResponse.set(fullMessage.requestId, {
        expectedResponseName: args.respondedToBy,
        resolve: resolveToStore,
        reject: rejectToStore,
      });
      return promise;
    }
    return fullMessage;
  }
  async processReceivedMessage(messageEvent) {
    var _a, _b, _c;
    if (
      // we are expecting consumers attached to elements to send messages via our custom event
      this.element &&
      messageEvent.type !== BlockCoreHandler.customEventName
    ) {
      return;
    } else if (!this.element) {
      if (
        // we are expecting consumers without elements to be sending messages via postMessage,
        // and for the 'data' on these messages to contain 'type' of our custom event name, and 'detail'
        messageEvent.type !== 'message' ||
        !('data' in messageEvent) ||
        !('detail' in messageEvent.data) ||
        messageEvent.data.type !== BlockCoreHandler.customEventName
      ) {
        return;
      }
    }
    const message =
      'detail' in messageEvent ? messageEvent.detail : messageEvent.data.detail;
    // if this isn't a BP message, or it's one the block sent, ignore it
    if (!BlockCoreHandler.isBlockProtocolMessage(message)) {
      return;
    } else if (message.source === 'block') {
      return;
    }
    const { errors, name, payload, requestId, respondedToBy, service } =
      message;
    const callback =
      (_b =
        (_a = this.messageCallbacksByService[service]) === null || _a === void 0
          ? void 0
          : _a[name]) !== null && _b !== void 0
        ? _b
        : this.defaultMessageCallback;
    if (callback) {
      if (respondedToBy) {
        const serviceHandler = this.services.get(service);
        if (!serviceHandler) {
          throw new Error(`Handler for service ${service} not registered.`);
        }
        const { payload: responsePayload, errors: responseErrors } =
          (_c = await callback({ payload, errors })) !== null && _c !== void 0
            ? _c
            : {};
        void this.sendMessage({
          partialMessage: {
            name: respondedToBy,
            payload: responsePayload,
            errors: responseErrors,
          },
          requestId,
          sender: serviceHandler,
        });
      } else {
        void callback({ payload, errors });
      }
    }
    // Check if this message is responding to another, and settle the outstanding promise
    const messageAwaitingResponse =
      this.settlersForMessagesAwaitingResponse.get(requestId);
    if (messageAwaitingResponse) {
      if (messageAwaitingResponse.expectedResponseName !== name) {
        throw new Error(
          `Message with requestId '${requestId}' expected response from message named '${messageAwaitingResponse.expectedResponseName}', received response from '${name}' instead.`
        );
      }
      messageAwaitingResponse.resolve({ payload, errors });
    }
  }
}
BlockCoreHandler.customEventName = 'blockprotocolmessage';
BlockCoreHandler.coreHandlerMap = new Map();
