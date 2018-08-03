# redis

Дополненный модуль node_redis для работы с socket.io и перенаправления сообщений по процессам

```js
// подключение
const redis = require('@devback/redis');
```

## createEmitter([userdata])

- `userdata` (object | null) данные пользователя для передачи с сообщениями

Создаем объект класса RedisEmitter и устанавливает данные пользователя для каждого сообщения

## listen(channel, methods)

- `channel` (string) название канала
- `methods` (object | function) объект где ключ название метода, а значение функция данного метода или функция

Слушает указанный канал и вызывает указанные методы с переданными данными.<br/>
Если вместо методов была указана функция, то первым аргументом передается метод

## middleware(channel, methods)

- `channel` (string) название канала
- `methods` (object | function) объект где ключ название метода, а значение функция данного метода или функция

Слушает указанный канал и устанавливает промежуточные методы или функцию
которые/которая получает последним аргументом функцию `next` чтобы передать выполнение дальше.
Если в `next` передать ошибку первым аргументом,
то выполнение остановиться и будет выброшен евент `middleware-error`

```js
const redis = {
    pub: require('@devback/redis').createClient(...),
    sub: require('@devback/redis').createClient(...)
};

// устанавливаем промежуточную функцию для валидации data
redis.sub.middleware('chat/global', function(method, userdata, data, next) {
    if(Object(data) !== data || typeof(data.msg) !== 'string') {
        return next(new Error('Неправильный формат сообщения'));
    }

    next();
});

// если сообщение дошло до listen, значит оно прошло все промежуточные функции успешно
redis.sub.listen('chat/global', {

    message: function(userdata, data) {
        console.log(userdata.userid); // будет 1

        console.log(data.msg); // будет "Hi!"
    }

});

// также можно слушать все сообщения одного канала
redis.sub.listen('chat/global', function(method, userdata, data) {

});

// или устанавливать промежуточную функцию только для одного метода
redis.sub.middleware('chat/global', {

    message: function(userdata, data, next) {

    }

});

// если одна из промежуточных функций вернула ошибку, то выбрасывается данная ошибка
redis.sub.on('middleware-error', function(err, obj) {
    // пример ошибки:
    // err = 'Неправильный формат сообщения'
    // obj = {
    //     method: 'message',
    //     userdata: {
    //         userid: 1
    //     },
    //     data: {
    //         msg: 'Hi!'
    //     }
    // }
});

setTimeout(function() {

    let emitter = redis.pub.createEmitter({
        userid: 1
    });

    emitter.send('chat/global', 'message', {
        msg: 'Hi!'
    });

}, 100);
```

# RedisEmitter

Класс который позволяет передавать сообщения по каналам redis с использованием методов

## send(channel, method, data[, callback])

- `channel` (string) название канала
- `method` (string) метод который будет вызываться на том конце для этого сообщения
- `data` (mix) данные что нужно передать
- `callback` (function) функция обратного вызова, которая будет передаваться во функцию publish

Отправляет сообщение по указанному каналу и с указанным методом и данными

## redirect(channel, method)

- `channel` (string) название канала
- `method` (string) метод который будет вызываться на том конце для этого сообщения

Перенаправляет сообщения от евентов (socket.io или другие) по указанному каналу и методу

```js
io.on('connection', function(socket) {
    // создаем RedisEmitter с данными которые нужно отправлять с каждым запросом
    let emitter = redis.createEmitter({
        socketid: socket.id,
        userid: socket.uid,
        lang: socket.lang
    });

    // создаем функцию перенаправления сообщений от сокета
    socket.on('chat/global:message', emitter.redirect('chat/global', 'message'));
});
```