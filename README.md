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
- `methods` (object) объект где ключ название метода, а значение функция данного метода

Слушает указанный канал и вызывает указанные методы с переданными данными

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