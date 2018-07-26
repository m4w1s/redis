'use strict';

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
    if(typeof(methods) !== 'object' || !methods) {
        throw new Error('Second argument must be an object');
    }

    let self = this;

    // если евент уже установлен, добавляем просто методы в список
    if(self._listenerChannels) {
        // проверяем если канал уже есть в списке
        if(self._listenerChannels[channel]) {
            // объединяем старые методы с новыми
            Object.assign(self._listenerChannels[channel], methods);
        }
        else {
            // если канал еще не существует, добавляем методы и подписываемся
            self._listenerChannels[channel] = methods;

            self.subscribe(channel);
        }

        return;
    }

    // объявляем _listenerChannels и добавляем методы
    self._listenerChannels = {};
    self._listenerChannels[channel] = methods;

    // слушаем сообщения по всем каналам и отсортировываем
    self.on('message', function(channel, message) {
        if(!self._listenerChannels && !self._listenerChannels[channel]) {
            throw new Error('Channel is not defined');
        }

        let obj;

        try {
            obj = JSON.parse(message);
        } catch(e) {
            return self.emit('error', e);
        }

        if(typeof(obj) !== 'object' || !obj) {
            return self.emit('error', new Error('Message is not an object'));
        }

        let method = self._listenerChannels[channel][obj.method];

        // если метод отсутствует, игнорируем сообщение
        if(typeof(method) !== 'function') return;

        if(typeof(obj.userdata) !== 'object' || !obj.userdata) {
            obj.userdata = {};
        }

        method(obj.userdata, obj.data);
    });

    self.subscribe(channel);
};

module.exports = redis;