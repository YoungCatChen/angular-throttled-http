# angular-throttled-http

**A throttled HTTP service for AngularJS.**

*Hold your browser from sending too many http requests at once.*

## Usage

To start, simply add `'yc.throttledHttp'` as a dependency to your application
module. Example:

    var yourMod = angular.module('yourModule', ['yc.throttledHttp']);

Then at your controller (or whatever object you have), use `throttledHttp`
like follows:

    yourMod.controller(function(throttledHttp) {
      var myHttp = throttledHttp.create(5);
      myHttp.get('/api/getApple').then(...);
      myHttp.get('/api/getPear').then(...);
      myHttp.post('/api/post42', {data: 42}, {timeout: 60}).then(...);
      for (var i = 0; i < 100; ++i) {
        myHttp.post('/api/postMany', {data: i}).then(...);
      }
    });

Firstly you create our own http object using
`var myHttp = throttledHttp.create(...)`, where `...` is the number of maximum
concurrent requests. The newly created `myHttp` object will have (almost) the
same API as angular's `$http` service, so you may just use the `myHttp` object
like what you used to do with `$http`. You may do `myHttp.get(...)`,
`myHttp.post(...)`, or even `myHttp({...(your config)...})`.

See https://docs.angularjs.org/api/ng/service/$http for `$http`'s API.

Note that we only support the methods like `then()`, `catch()`, `finally()`,
etc., the ones supported by the `Promise` API described at
https://docs.angularjs.org/api/ng/service/$q. The legacy `$http` promise
methods `success()` and `error()` are not supported.
