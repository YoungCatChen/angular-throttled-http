/**
 * @license
 * Copyright 2015 YoungCat CHEN (chxuexuan@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview A throttled HTTP service for AngularJS.
 *
 * Note that the jsdoc annotations and goog.provide() statements are used by
 * the Closure Compiler (https://developers.google.com/closure/compiler/).
 * Use throttled_http_no_closure.js if you don't use the Closure Library at all.
 */

'use strict';

var yc = window.yc = window.yc || {};
yc.throttledHttp = yc.throttledHttp || {};
// goog.provide('yc.throttledHttp.Service');
// goog.provide('yc.throttledHttp.Throttler');
// goog.provide('yc.throttledHttp.module');


/**
 * The angular module for our throttledHttp.
 *
 * To start, simply add it as a dependency to your application module.
 * Example: var yourMod = angular.module('yourModule', ['yc.throttledHttp']);
 *
 * @const {!angular.Module}
 */
yc.throttledHttp.module = angular.module('yc.throttledHttp', []);



/**
 * The angular service that you're going to use. Example:
 *
 * yourMod.controller(function(throttledHttp) {
 *   var myHttp = throttledHttp.create(5);
 *   myHttp.get('/api/getApple').then(...);
 *   myHttp.get('/api/getPear').then(...);
 *   myHttp.post('/api/post42', {data: 42}, {timeout: 60}).then(...);
 *   for (var i = 0; i < 100; ++i) {
 *     myHttp.post('/api/postMany', {data: i}).then(...);
 *   }
 * });
 *
 * Firstly you create our own http object using
 * var myHttp = throttledHttp.create(...), where ... is the number of maximum
 * concurrent requests. The newly created myHttp object will have (almost) the
 * same API as angular's $http service, so you may just use the myHttp object
 * like what you used to do with $http. You may do myHttp.get(...),
 * myHttp.post(...), or even myHttp({...(your config)...}).
 *
 * See https://docs.angularjs.org/api/ng/service/$http for $http's API.
 *
 * Note that we only support the methods like then(), catch(), finally(),
 * etc., the ones supported by the Promise API described at
 * https://docs.angularjs.org/api/ng/service/$q. The legacy $http promise
 * methods success() and error() are not supported.
 *
 * @constructor
 * @struct
 * @final
 * @ngInject
 * @param {angular.$http} $http
 * @param {!angular.$q} $q
 */
yc.throttledHttp.Service = function($http, $q) {
  /**
   * @private @const
   */
  this.http_ = $http;
  /**
   * @private @const
   */
  this.q_ = $q;
};

yc.throttledHttp.module.service('throttledHttp', yc.throttledHttp.Service);


/**
 * @param {number} nConnection
 * @return {angular.$http}
 */
yc.throttledHttp.Service.prototype.create = function(nConnection) {
  var throttler =
      new yc.throttledHttp.Throttler(this.http_, this.q_, nConnection);
  var issueHttpFn =
      /** @type {angular.$http} */ (throttler.issueHttp.bind(throttler));
  angular.extend(issueHttpFn, throttler.shortMethods);
  return issueHttpFn;
};



/**
 * @constructor
 * @struct
 * @final
 * @param {angular.$http} $http
 * @param {!angular.$q} $q
 * @param {number} nConnection
 */
yc.throttledHttp.Throttler = function($http, $q, nConnection) {
  /**
   * @private @const
   */
  this.http_ = /** @type {function(angular.$http.Config):
      !angular.$q.Promise<!angular.$http.Response>} */ ($http);

  /**
   * @private @const
   */
  this.q_ = $q;
  /**
   * @private @const
   */
  this.nConnection_ = nConnection;
  /**
   * @private @type {number}
   */
  this.nOngoing_ = 0;
  /**
   * @private @type {!Array<{
   *   deferred: !angular.$q.Deferred,
   *   config: !angular.$http.Config
   * }>}
   */
  this.queue_ = [];

  /**
   * @type {!Object<string,
   *   (function(string, angular.$http.Config=): !angular.$q.Promise |
   *    function(string, *, angular.$http.Config=): !angular.$q.Promise)
   *  >}
   */
  this.shortMethods = {};

  this.createShortMethods_(['get', 'delete', 'head', 'jsonp']);
  this.createShortMethodsWithData_(['post', 'put', 'patch']);
};


/**
 * @private
 * @param {!Array<string>} names
 */
yc.throttledHttp.Throttler.prototype.createShortMethods_ = function(names) {
  names.forEach(function(/** string */ name) {

    /**
     * @param {string} url
     * @param {angular.$http.Config=} opt_config
     * @return {!angular.$q.Promise}
     * @this {yc.throttledHttp.Throttler}
     */
    var shortMethod = function(url, opt_config) {
      var newConfig = {};
      angular.extend(newConfig, opt_config || {}, {
        method: name,
        url: url,
      });
      return this.issueHttp(newConfig);
    };

    this.shortMethods[name] = shortMethod.bind(this);

  }.bind(this));
};


/**
 * @private
 * @param {!Array<string>} names
 */
yc.throttledHttp.Throttler.prototype.createShortMethodsWithData_ =
function(names) {
  names.forEach(function(/** string */ name) {

    /**
     * @param {string} url
     * @param {*} data
     * @param {angular.$http.Config=} opt_config
     * @return {!angular.$q.Promise}
     * @this {yc.throttledHttp.Throttler}
     */
    var shortMethod = function(url, data, opt_config) {
      var newConfig = {};
      angular.extend(newConfig, opt_config || {}, {
        method: name,
        url: url,
        data: data,
      });
      return this.issueHttp(newConfig);
    };

    this.shortMethods[name] = shortMethod.bind(this);

  }.bind(this));
};


/**
 * @param  {angular.$http.Config} config
 * @return {!angular.$q.Promise}
 */
yc.throttledHttp.Throttler.prototype.issueHttp = function(config) {
  var deferred = this.q_.defer();
  var item = {deferred: deferred, config: config};
  this.queue_.push(item);
  this.dispatch_();
  return deferred.promise;
};


/**
 * @private
 */
yc.throttledHttp.Throttler.prototype.dispatch_ = function() {
  if (this.nOngoing_ >= this.nConnection_) return;
  if (this.queue_.length == 0) return;

  this.nOngoing_++;
  var queueItem = this.queue_.shift();

  this.http_(queueItem.config)
  .finally(function() {
    this.nOngoing_--;
    this.dispatch_();
  }.bind(this))
  .then(function(value) {
    queueItem.deferred.resolve(value);
  }, function(/** * */ error) {
    queueItem.deferred.reject(error);
  });
};
