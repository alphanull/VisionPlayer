/**
 * The publisher module. Provides pub/sub functionality with extensive wildcard support and also content based filtering.
 * @module lib/util/publisher
 * @author Frank Kudermann - alphanull
 * @version 1.5.1
 * @license MIT
 */
export default {
    configure,
    publish,
    subscribe,
    unsubscribe,
    removePersistentMessage
};

/* TYPE DEFINITIONS */

/**
 * @typedef  {Object} module:lib/util/publisher~globalOptions    Options for the publisher. These can be changed on a global basis by the configure() method.
 * @property {boolean} [async=true]                If set to "false", messages are sent directly, otherwise with a timeout.
 * @property {boolean} [handleExceptions=false]    If this is true, any exceptions are catched, so that a faulty handler cannot disturb further publishing.
 * @property {boolean} [lenientUnsubscribe=false]  If this is true, unsubsribing a non-existant subscription or handler will not throw an error.
 */

/**
 * @typedef  {Object} module:lib/util/publisher~subscriberObject Structure of a single Subscriber
 * @property {string}                                              token      The token of this subscriber.
 * @property {string}                                              topic      The topic of this subscriber.
 * @property {Function}                                            handler    The handler to execute when a mathing publish event occurs.
 * @property {number}                                              timeOutId  The ID of the timeout when using async publish. Used to clean up when unsubscribe occurs and the handler is still waiting.
 * @property {Object<module:lib/util/publisher~subscriberOptions>} options    The various subscriber options.
 */

/**
 * @typedef  {Object} module:lib/util/publisher~subscriberOptions    Options for the subscriber. These can be used by publish or subscribe commands, except when noted.
 * @property {boolean}  [async]             If set to "false", messages are sent directly to this subscriber, otherwise with a timeout.
 * @property {boolean}  [handleExceptions]  If this is true, any exceptions are catched, so that a faulty handler cannot disturb further publishing.
 * @property {Function} [condition]         A function to be evaluated before a matching subscriber is executed. Must return true to continue.
 * @property {boolean}  [persist]           If this is set to true, the messages is saved for later subscribers which want to be notified of persistent messages.
 * @property {number}   [priority]          Subscribe only: specifies with which priority the handler should be executed. The higher the number, the higher the priority. Default is "0", negative values are allowed.
 */

/* INTERNAL PROPERTIES */

/**
 * Global options for the publisher, can be changed by the setOptions method.
 * @private
 * @memberof module:lib/util/publisher
 * @type {module:lib/util/publisher~globalOptions}
 */
const globalOptions = {
    async: true,
    handleExceptions: false,
    lenientUnsubscribe: false
};

/**
 * Internal value to create unique tokens. This is increased everytime you subscribe.
 * @private
 * @memberof module:lib/util/publisher
 * @type {number}
 */
let tokenCounter = -1;

/**
 * Object which contains all subscribers, using the token as key.
 * @private
 * @memberof module:lib/util/publisher
 * @type     {Map<module:lib/util/publisher~subscriberObject>}
 * @property {module:lib/util/publisher~subscriberObject}      subscriberObject  The subscriber object containing all necessary information.
 */
const subscrs = new Map();

/**
 * Object which contains a tree graph of all subscriptions.
 * @private
 * @memberof module:lib/util/publisher
 * @type {Map<Object>}
 */
const subsTree = new Map();

/**
 * Object which contains persistent messages (published with the "persist" option).
 * @private
 * @memberof module:lib/util/publisher
 * @type {Map<Object>}
 */
const persistentMessages = new Map();

/**
 * Executes a function asynchronously, using the most performant available method.
 * Falls back to setTimeout if no microtask queue is available.
 * @private
 * @memberof module:lib/util/publisher
 * @param {Function} fn  The function to execute.
 */
function deferExecution(fn) {
    if (typeof queueMicrotask === 'function') queueMicrotask(fn);
    else if (typeof Promise === 'function') Promise.resolve().then(fn);
    else setTimeout(fn, 0);
}

/**
 * Checks if the given value is undefied.
 * @param   {*}       obj  The value to check.
 * @returns {boolean}      True if the value is undefined, false otherwise.
 */
function isUndefined(obj) {
    return typeof obj === 'undefined';
}

/* PUBLIC API */

/**
 * Sets global options for the publisher. All subsequent actions use these options.
 * @memberof module:lib/util/publisher
 * @param {Object<module:lib/util/publisher~globalOptions>} options  An object containing various options.
 */
export function configure({ async, handleExceptions, lenientUnsubscribe } = {}) {

    if (!isUndefined(async)) globalOptions.async = async;
    if (!isUndefined(handleExceptions)) globalOptions.handleExceptions = handleExceptions;
    if (!isUndefined(lenientUnsubscribe)) globalOptions.lenientUnsubscribe = lenientUnsubscribe;

}

/**
 * Publishes a message to all matching subscribers.
 * @memberof module:lib/util/publisher
 * @param   {string}  topic                       The topic of this message, may be separated with '/' for subtopics.
 * @param   {Object}  [data]                      The data that should be sent along with the event. Can be basically any javascript object.
 * @param   {Object}  [options={}]                Additional options.
 * @param   {boolean} [options.async]             Specify if we should deliver this  message directly or with a timeout. Overrides the global setting.
 * @param   {boolean} [options.handleExceptions]  Specify if we should catch any exceptions while sending this message. Overrides the global setting.
 * @param   {boolean} [options.persist]           If this is set to true, the messages is saved for later subscribers which want to be notified of persistent messages.
 * @param   {boolean} [options.cancelable]        If set to "true" this message cannot be cancelled (when sending synchronously).
 * @returns {boolean}                             Returns false if a synchronous event was cancelled by a handler.
 * @throws  {Error}                               When trying to use a wildcard for publishing.
 */
export function publish(topic, data, options = {}) {

    // check if this message is persistent and must be saved for later use
    if (options.persist === true) {
        persistentMessages.set(topic, {
            data,
            options
        });
    }

    if (topic.indexOf('*') > -1) throw new Error('Publish topic cannot contain any wildcards.');

    const matchedSubscribers = findSubscribers(topic.split('/'), data, options, subsTree, topic);

    // sort handlers by priority
    matchedSubscribers.sort((a, b) => {
        if (a.priority === b.priority) { return a.position - b.position; } // emulate stable sort
        if (a.priority > b.priority) { return -1; }
        return 1;
    });

    // finally, execute them
    let subscriber;

    const async = isUndefined(options.async) ? globalOptions.async : options.async;

    while ((subscriber = matchedSubscribers.shift())) {

        if (async) {
            deferExecution(executeHandler.bind(null, subscriber, topic, data, options));
        } else if (executeHandler(subscriber, topic, data, options) === false && options.cancelable !== false) {
            return false;
        }

    }

    return true;

}

/**
 * Subscribes to certain message(s).
 * @memberof module:lib/util/publisher
 * @param   {string}   topic                       The topic in which the subscriber is interested. Note that you can use wildcards, ie. The topic "*" will subscribe to all messages.
 * @param   {Function} handler                     The handler to execute when a matching message is found.
 * @param   {Object}   [options={}]                Additional options.
 * @param   {boolean}  [options.async]             Specify if we should deliver this  message directly or with a timeout. Overrides the global setting.
 * @param   {boolean}  [options.handleExceptions]  Specify if we should catch any exceptions while sending this message. Overrides the global setting.
 * @param   {boolean}  [options.persist]           If this is set to true, the subscriber is notified of any former, persistent messages.
 * @param   {Function} [options.condition]         A function which receives this topic and data just before execution, if present. If this returns anything but true, the message is not delivered.
 * @param   {number}   [options.priority=0]        Specifies with which priority the handler should be executed. The higher the number, the higher the priority. Default is "0", negative values are allowed.
 * @param   {number}   [options.invocations]       Specifies how many times the subscriptions should be executed after a matching event. If this value reaches "0", the handler is automatically unsubscribed.
 * @returns {number}                               The internal token of the new subscriber. Can be used for later unsubscribing.
 * @throws  {Error}                                If topic or handler are undefined.
 */
export function subscribe(topic, handler, options = {}) {

    const token = tokenCounter += 1;

    if (isUndefined(topic)) {
        throw new Error('Subscribe failed - undefined Topic.');
    }

    if (topic.includes('undefined')) {
        throw new Error(`Subscribe for '${topic}' failed - found 'undefined' in topic, this is almost always an error: ${token}`);
    } // $$$ TEMP

    if (isUndefined(handler)) {
        throw new Error(`Subscribe for '${topic}' failed - undefined Handler`);
    } // $$$ TEMP

    // Add to Subscribers Object
    const subscriber = {
        token,
        topic,
        handler,
        options
    };

    subscrs.set(token, subscriber);
    addSubscription(topic.split('/'), subscriber, subsTree); // build Graph

    if (options.persist !== true) return token; // return the token (as Number)

    const regex = new RegExp(`^${topic.replace('*', '(.+)')}(/.+)?$`);

    // check persistent messages for matching topic
    for (const [key, persistentMessage] of persistentMessages) {

        const match = key.match(regex);

        if (match) {

            const async = isUndefined(persistentMessage.options.async) ? globalOptions.async : persistentMessage.options.async;

            if (async) {
                deferExecution(executeHandler.bind(null, subscriber, key, persistentMessage.data, options));
            } else if (executeHandler(subscriber, key, persistentMessage.data, options) === false && options.cancelable === true) {
                break;
            }
        }
    }

    return token; // return the token (as Number)

}

/**
 * Unsubscribes one or more subscribers. Note that here, the second argument can mean either a handler or the "lenient" option.
 * @memberof module:lib/util/publisher
 * @param  {number|number[]|string} topicOrToken          The token or the topic to unsubscribe. In the first case, these also can be in an Array to support multiple unsubscriptions.
 * @param  {Function|boolean}       [handler]             If specified, the message is only unsubscribed if the handler also matches.
 * @param  {boolean}                [lenientUnsubscribe]  If set to true, unsubscribe won't throw an error if the handler or token is not found.
 * @throws {Error}                                        If no subscribers were found.
 */
export function unsubscribe(topicOrToken, handler, lenientUnsubscribe) {

    const lenientArg = handler === Boolean(handler) ? handler : lenientUnsubscribe,
          lenient = isUndefined(lenientArg) ? globalOptions.lenientUnsubscribe : lenientArg;

    const unsubscribeToken = token => {

        const subscriber = subscrs.get(token);

        if (isUndefined(subscriber)) {
            if (lenient === true) return;
            throw new Error(`Unsubscribe failed. Did not find subscriber for token: ${token}`);
        }

        removeSubscription(subscriber.topic.split('/'), subscriber, subsTree);
        subscrs.delete(token);

    };

    if (isUndefined(topicOrToken)) {
        if (lenient === true) return;
        throw new Error('Unsubscribe failed. No Arguments specified.');
    }

    // check for unsubscribe type
    if (Array.isArray(topicOrToken)) { // array of tokens, so iterate over it

        topicOrToken.forEach(topic => unsubscribeToken(topic));

    } else if (!isNaN(parseFloat(topicOrToken)) && isFinite(topicOrToken)) { // it's a Number, so it is a single token

        unsubscribeToken(topicOrToken);

    } else {

        // assume topic & handler based unsubscribe
        // check for existing handler first

        if (isUndefined(handler)) {
            if (lenient === true) return;
            throw new Error(`Unsubscribe failed. No handler for topic based unsubscribe specified ${topicOrToken}`);
        }

        // TODO: not really efficient,
        // consider walking the topic tree instead
        for (const [, subscriber] of subscrs) {
            if (subscriber.handler === handler && subscriber.topic === topicOrToken) {
                removeSubscription(topicOrToken.split('/'), subscriber, subsTree);
                subscrs.delete(subscriber.token);
                break;
            }
        }

    }

}

/**
 * Removes a previously added persistent message.
 * @memberof module:lib/util/publisher
 * @param {string} topic  The topic of the message to remove.
 */
export function removePersistentMessage(topic) {

    persistentMessages.delete(topic);

}

/* PRIVATE METHODS */

/**
 * This method actually executes the message handler.
 * @private
 * @memberof module:lib/util/publisher
 * @param   {module:lib/util/publisher~subscriberObject} subscriber    The subscriber to execute.
 * @param   {string}                                     topic         The message topic.
 * @param   {Object}                                     data          The message data which should be passed to the handler.
 * @param   {Object}                                     [options={}]  Object which holds the publish options.
 * @returns {any}                                                      Returns the handlers result.
 */
function executeHandler(subscriber, topic, data, options = {}) {

    // prevent async handler to be called when subscriber has been removed meanwhile
    if (!subscrs.has(subscriber.token)) { return; }

    if (subscriber.options.invocations > 0) {
        subscriber.options.invocations -= 1;
        if (subscriber.options.invocations < 1) unsubscribe(subscriber.token);
    }

    const { handler } = subscriber;

    if (options.handleExceptions !== true && globalOptions.handleExceptions !== true) {
        return subscriber.options.topicArg === true ? handler(topic, data) : handler(data, topic);
    }

    try {
        return subscriber.options.topicArg === true ? handler(topic, data) : handler(data, topic);
    } catch (e) {
        if (window.console && window.console.error) {
            window.console.error('Exception while executing publish handler: ', e);
        }
    }

}

/**
 * Internal Function to recursively walk the subscription graph according to the current topic scope. Any found subscribers are added to the return array.
 * @private
 * @memberof module:lib/util/publisher
 * @param   {string[]}                                     topicArray     Hold eachs segments of the topic in an array, also reflecting the current scope.
 * @param   {Object}                                       data           The current data which was sent along the message.
 * @param   {Object}                                       [options={}]   Current publishing options.
 * @param   {Object}                                       subscriptions  Part of the subscriptions tree, reflecting the current scope.
 * @param   {string}                                       originalTopic  Original message topic.
 * @param   {Array}                                        handlerArray   array with all found handlers.
 * @returns {module:lib/util/publisher~subscriberObject[]}                Array with matching subscribers.
 */
function findSubscribers(topicArray, data, options = {}, subscriptions, originalTopic, handlerArray = []) { // eslint-disable-line max-params

    const subscribers = subscriptions.get('subscribers') || new Map(),
          topics = subscriptions.get('topics');

    for (const [, subscriber] of subscribers) {

        const { condition, topicArg } = subscriber.options; // condition for content based publishing

        if (isUndefined(condition) || (topicArg === true ? condition(originalTopic, data) === true : condition(data, originalTopic) === true)) { // TODO: Refactor
            // last but not least, check if there are any additional conditions set
            subscriber.position = handlerArray.push(subscriber);
            subscriber.priority = subscriber.options.priority || 0;
            subscriber.async = Boolean(options.async || subscriber.options.async || globalOptions.async);
        }

    }

    if (topicArray.length && topics) {

        const subscription = topics.get(topicArray[0]),
              subscriptionWild = topics.get('*');

        if (!isUndefined(subscriptionWild) || !isUndefined(subscription)) {

            // if there are further subscriptions on this node, recurse
            if (!isUndefined(subscriptionWild)) {
                findSubscribers(topicArray.slice(1, topicArray.length), data, options, subscriptionWild, originalTopic, handlerArray);
            }

            if (!isUndefined(subscription)) {
                findSubscribers(topicArray.slice(1, topicArray.length), data, options, subscription, originalTopic, handlerArray);
            }

            topicArray.shift();

        }

    }

    return handlerArray;

}

/**
 * Internal function to add a subscription to the subscriptions graph.
 * @private
 * @memberof module:lib/util/publisher
 * @param {string[]}                                           topicArray     Hold eachs segments of the topic in an array, also reflecting the current scope.
 * @param {Object<module:lib/util/publisher~subscriberObject>} subscriber     The subscriber to add.
 * @param {Object}                                             subscriptions  Part of the subscription graph, reflecting the current scope.
 */
function addSubscription(topicArray, subscriber, subscriptions) {

    const [topic] = topicArray;

    if (isUndefined(subscriptions.get('topics'))) {
        subscriptions.set('topics', new Map());
    }

    const subTopic = subscriptions.get('topics');

    let subscription = subTopic.get(topic);

    if (isUndefined(subscription)) {
        subscription = new Map();
        subTopic.set(topic, subscription);
    }

    if (topicArray.length < 2) {

        // last segment, add subscriber
        if (isUndefined(subscription.get('subscribers'))) {
            subscription.set('subscribers', new Map());
        }

        subscription.get('subscribers').set(subscriber.token, subscriber);

    } else {

        // recurse
        topicArray.shift();
        addSubscription(topicArray, subscriber, subscription);

    }

}

/**
 * Internal Function to recursively walk the subscription graph according to the current topic scope.
 * @private
 * @memberof module:lib/util/publisher
 * @param {string[]}                                           topicArray     Hold eachs segments of the topic in an array, also reflecting the current scope.
 * @param {Object<module:lib/util/publisher~subscriberObject>} subscriber     The subscriber to remove.
 * @param {Object}                                             subscriptions  Part of the subscriptions tree, reflecting the current scope.
 */
function removeSubscription(topicArray, subscriber, subscriptions) {

    const [topic] = topicArray,
          topics = subscriptions.get('topics'),
          subTopic = topics.get(topic),
          subscribers = subTopic.get('subscribers');

    if (topicArray.length < 2) {

        // last segment, remove subscriber
        subscribers.delete(subscriber.token);

        if (subscribers.size === 0) subTopic.delete('subscribers');

    } else {
        // recurse
        topicArray.shift();
        removeSubscription(topicArray, subscriber, subTopic);
    }

    // cleanup any empty graph elements
    if (subTopic.has('topics') && subTopic.get('topics').size === 0) subTopic.delete('topics');
    if (topics.get(topic).size === 0) topics.delete(topic);

}
