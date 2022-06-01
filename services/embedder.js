export class EmbedderServiceHandler {
  constructor({ element, serviceName }) {
    this.element = element !== null && element !== void 0 ? element : null;
    this.serviceName = serviceName;
    this.coreHandler = EmbedderCoreHandler.registerService({
      element,
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
  sendMessage({ message, respondedToBy }) {
    return this.coreHandler.sendMessage({
      partialMessage: message,
      respondedToBy,
      sender: this,
    });
  }
}
export class EmbedderCoreHandler {
  constructor({ callbacks, defaultMessageCallback, element }) {
    this.serviceName = 'core';
    this.defaultMessageCallback = defaultMessageCallback;
    this.settlersForMessagesAwaitingResponse = new Map();
    this.messageCallbacksByService =
      callbacks !== null && callbacks !== void 0 ? callbacks : {};
    this.services = new Map();
    this.element = element;
    this.attachEventListeners();
    EmbedderCoreHandler.instanceMap.set(element, this);
  }
  static registerService({ element, service }) {
    var _a, _b;
    var _c;
    const { serviceName } = service;
    const handler =
      (_a = this.instanceMap.get(element)) !== null && _a !== void 0
        ? _a
        : new EmbedderCoreHandler({ element });
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
  isSelfContainedBlock() {
    return this.element instanceof HTMLIFrameElement;
  }
  attachEventListeners() {
    if (!this.element) {
      throw new Error(
        'Cannot attach event listeners before element set on EmbedderCoreHandler instance.'
      );
    }
    if (this.element instanceof HTMLIFrameElement) {
      if (!this.element.contentWindow) {
        throw new Error('No contentWindow present on iFrame.');
      }
      this.element.contentWindow.addEventListener('message', (event) => {
        void this.processReceivedMessage(event);
      });
    } else {
      this.element.addEventListener(
        EmbedderCoreHandler.customEventName,
        (event) => {
          void this.processReceivedMessage(event);
        }
      );
    }
  }
  removeEventListeners() {
    var _a, _b;
    if (this.element instanceof HTMLIFrameElement) {
      (_a = this.element.contentWindow) === null || _a === void 0
        ? void 0
        : _a.removeEventListener('message', (event) => {
            void this.processReceivedMessage(event);
          });
    } else {
      (_b = this.element) === null || _b === void 0
        ? void 0
        : _b.removeEventListener(
            EmbedderCoreHandler.customEventName,
            (event) => {
              void this.processReceivedMessage(event);
            }
          );
    }
  }
  updateElement(element) {
    this.removeEventListeners();
    this.element = element;
    this.attachEventListeners();
  }
  updateElementFromEvent(event) {
    if (!event.target) {
      throw new Error('Could not update element from event – no event.target.');
    }
    if (!(event.target instanceof HTMLElement)) {
      throw new Error(
        "'blockprotocolmessage' event must be sent from an HTMLElement."
      );
    }
    this.updateElement(event.target);
  }
  processInitMessage({ event, message }) {
    // If we're dealing with a component block, update the element to send events on
    // to the element the block dispatched the init message from
    if (!this.isSelfContainedBlock() && event instanceof CustomEvent) {
      this.updateElementFromEvent(event);
    }
    // get the properties sent on initialization for any registered services
    const payload = {};
    for (const [serviceName, serviceInstance] of this.services) {
      payload[serviceName] = serviceInstance.getInitPayload();
    }
    const response = {
      name: 'initResponse',
      payload,
    };
    void this.sendMessage({
      partialMessage: response,
      requestId: message.requestId,
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
  sendMessage({ partialMessage, requestId, respondedToBy, sender }) {
    if (!sender.serviceName) {
      throw new Error('Message sender has no serviceName set.');
    }
    const fullMessage = Object.assign(Object.assign({}, partialMessage), {
      requestId:
        requestId !== null && requestId !== void 0 ? requestId : uuid(),
      service: sender.serviceName,
      source: 'embedder',
    });
    if (this.element instanceof HTMLIFrameElement) {
      this.element.contentWindow.postMessage(
        {
          detail: fullMessage,
          type: EmbedderCoreHandler.customEventName,
        },
        '*'
      );
    } else {
      const event = new CustomEvent(EmbedderCoreHandler.customEventName, {
        bubbles: true,
        composed: true,
        detail: fullMessage,
      });
      this.element.dispatchEvent(event);
    }
    if (respondedToBy) {
      let resolveToStore = undefined;
      let rejectToStore = undefined;
      const promise = new Promise((resolve, reject) => {
        resolveToStore = resolve;
        rejectToStore = reject;
      });
      this.settlersForMessagesAwaitingResponse.set(fullMessage.requestId, {
        expectedResponseName: respondedToBy,
        resolve: resolveToStore,
        reject: rejectToStore,
      });
      return promise;
    }
    return fullMessage;
  }
  async processReceivedMessage(messageEvent) {
    var _a, _b, _c;
    console.log({ messageEvent });
    if (this.isSelfContainedBlock()) {
      // we are expecting self-contained blocks to be sending messages via postMessage,
      // and for the 'data' on these messages to contain 'type' of our custom event name, and 'detail'
      if (
        messageEvent.type !== 'message' ||
        !('data' in messageEvent) ||
        !('detail' in messageEvent.data) ||
        messageEvent.data.type !== EmbedderCoreHandler.customEventName
      ) {
        return;
      }
    } else if (messageEvent.type !== EmbedderCoreHandler.customEventName) {
      // for component-type blocks, we expect messages to be transported in our CustomEvent
      return;
    }
    const message =
      'detail' in messageEvent ? messageEvent.detail : messageEvent.data.detail;
    console.log({ message });
    // if this isn't a BP message, or it's one the embedder sent, ignore it
    if (!EmbedderCoreHandler.isBlockProtocolMessage(message)) {
      return;
    } else if (message.source === 'embedder') {
      return;
    }
    const { errors, name, payload, requestId, respondedToBy, service } =
      message;
    if (service === 'core' && name === 'init') {
      this.processInitMessage({ event: messageEvent, message });
      return;
    }
    const callback =
      (_b =
        (_a = this.messageCallbacksByService[service]) === null || _a === void 0
          ? void 0
          : _a[name]) !== null && _b !== void 0
        ? _b
        : this.defaultMessageCallback;
    if (respondedToBy && !callback) {
      throw new Error(
        `Message '${name}' expected a response, but no callback for '${name}' provided.`
      );
    }
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
EmbedderCoreHandler.customEventName = 'blockprotocolmessage';
EmbedderCoreHandler.instanceMap = new Map();
