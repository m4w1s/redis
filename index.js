'use strict';

const async = require('async');
const redis = require('redis');

function RedisEmitter(client, userdata) {
    this.client = client;

    this.userdata = userdata;
}

RedisEmitter.prototype.send = function(channel, method, data, callback) {
    let obj = {
        method: method,
        userdata: this.userdata,
        data: data
    };

    this.client.publish(channel, JSON.stringify(obj), callback);
};

RedisEmitter.prototype.redirect = function(channel, method) {
    let self = this;

    // возвращаем функцию для прослушивания евента и переадресации данных
    return function(data) {
        self.send(channel, method, data);
    };
};

redis.RedisClient.prototype.createEmitter = function(userdata) {
    return new RedisEmitter(this, userdata);
};

redis.RedisClient.prototype.listen = function(channel, methods) {
    listenRedisChannel(this, channel, methods);

    return this;
};

redis.RedisClient.prototype.middleware = function(channel, methods) {
    listenRedisChannel(this, channel, methods, true);

    return this;
};

function listenRedisChannel(client, channel, methods, isMiddleware) {
    if(Object(methods) !== methods && typeof(methods) !== 'function') {
        throw new Error('Methods must be an object or function');
    }

    // если евент уже установлен, не нужно его повторно устанавливать
    if(addListenerMethods(client, channel, methods, isMiddleware)) return;

    // слушаем сообщения по всем каналам и отсортировываем
    client.on('message', function(channel, message) {
        // если не находим канал в списке, выбрасываем ошибку
        if(!client._listenerChannels || !client._listenerChannels[channel]) {
            return client.emit('error', new Error('Channel is not defined'));
        }

        let obj, list = client._listenerChannels[channel];

        try {
            obj = unpackMessage(message);
        } catch(e) {
            return client.emit('error', e);
        }

        handleListenerMessages(client, list, obj);
    });
}

function handleListenerMessages(client, list, obj) {
    let listener = list[0], middlewares = [];

    // добавляем все общие функции из списка middleware
    for(let i = 0, l = listener[0].length; i < l; i++) {
        let func = listener[0][i];

        if(typeof(func) !== 'function') continue;

        middlewares.push(
            async.apply(func, obj.method, obj.userdata, obj.data)
        );
    }

    if(listener[1][obj.method]) {
        for(let i = 0, l = listener[1][obj.method].length; i < l; i++) {
            let func = listener[1][obj.method][i];

            if(typeof(func) !== 'function') continue;

            middlewares.push(
                async.apply(func, obj.userdata, obj.data)
            );
        }
    }

    async.series(middlewares, function(err, results) {
        if(err) {
            return client.emit('middleware-error', err, obj);
        }

        emitListenerMethods(list[1], obj);
    });
}

function emitListenerMethods(listener, obj) {
    // вызываем все методы по очереди
    for(let i = 0, l = listener[0].length; i < l; i++) {
        let func = listener[0][i];

        if(typeof(func) !== 'function') continue;

        func(obj.method, obj.userdata, obj.data);
    }

    if(listener[1][obj.method]) {
        for(let i = 0, l = listener[1][obj.method].length; i < l; i++) {
            let func = listener[1][obj.method][i];

            if(typeof(func) !== 'function') continue;

            func(obj.userdata, obj.data);
        }
    }
}

function addListenerMethods(client, channel, methods, isMiddleware) {
    let inited = true;

    // если объект еще не установлен, значит это первый вызов
    if(!client._listenerChannels) {
        inited = false;
        client._listenerChannels = {};
    }

    let listener = client._listenerChannels[channel];

    // если мы еще не слушаем этот канал, создаем его
    if(!listener) {
        // создаем структуру данных
        listener = client._listenerChannels[channel] = [
            [ [], {} ],
            [ [], {} ]
        ];

        client.subscribe(channel);
    }

    // выбираем нужный массив для записи методов
    listener = listener[isMiddleware ? 0 : 1];

    if(typeof(methods) === 'function') {
        listener[0].push(methods);
    }
    else {
        for(let k in methods) {
            let ev = listener[1][k];

            if(!ev) {
                ev = listener[1][k] = [];
            }

            ev.push(methods[k]);
        }
    }

    return inited;
}

function unpackMessage(msg) {
    let obj;

    try {
        obj = JSON.parse(msg);
    } catch(e) {
        throw new Error('Message parse error');
    }

    if(Object(obj) !== obj) {
        throw new Error('Invalid message data type');
    }

    if(Object(obj.userdata) !== obj.userdata) {
        obj.userdata = {};
    }

    return obj;
}

module.exports = redis;