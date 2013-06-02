(function() {
  var Auth, List, ViewModel, getParameterByName, saved, storageKey, vm,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  storageKey = 'data-v2';

  getParameterByName = function(name) {
    var regex, regexS, results;

    name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
    regexS = '[\\?&]' + name + '=([^&#]*)';
    regex = new RegExp(regexS);
    results = regex.exec(window.location.href);
    if (results != null) {
      return decodeURIComponent(results[1].replace(/\+/g, ' '));
    } else {
      return '';
    }
  };

  ko.bindingHandlers.showModal = {
    init: function(element, valueAccessor) {},
    update: function(element, valueAccessor) {
      var value;

      value = valueAccessor();
      if (ko.utils.unwrapObservable(value)) {
        $(element).modal('show');
        return $("input", element).focus();
      } else {
        return $(element).modal('hide');
      }
    }
  };

  List = (function() {
    function List(vm, saved) {
      this.send = __bind(this.send, this);
      var _ref;

      if (saved == null) {
        saved = {};
      }
      this.text = ko.observable((_ref = saved.text) != null ? _ref : "");
      this.sending = ko.observable(false);
      this.vm = vm;
      this.text.subscribe(function(newValue) {
        return vm.save();
      });
    }

    List.prototype.sendLine = function(line, callback) {
      return this.vm.auth.addTask(line, function(data) {
        if (data.rsp.stat === "ok") {
          return callback();
        }
      });
    };

    List.prototype.send = function() {
      var lines, sendTask,
        _this = this;

      if (!this.sending()) {
        lines = this.text().split('\n');
        sendTask = function(index) {
          var task;

          if (index < lines.length) {
            task = $.trim(lines[index]);
            if (task.length > 0) {
              return _this.sendLine(task, function() {
                return sendTask(index + 1, length);
              });
            } else {
              return sendTask(index + 1, length);
            }
          } else {
            return _this.sending(false);
          }
        };
      }
      this.sending(true);
      return sendTask(0);
    };

    List.prototype.toJSON = function() {
      var copy;

      copy = ko.toJS(this);
      delete copy.vm;
      delete copy.sending;
      return copy;
    };

    return List;

  })();

  Auth = (function() {
    function Auth(vm, saved) {
      this.redirectToRTM = __bind(this.redirectToRTM, this);
      this.logOut = __bind(this.logOut, this);
      var _ref, _ref1;

      if (!((window.apiKey != null) && (window.sharedSecret != null))) {
        vm.fatalError('apiKey and sharedSecret have not been defined. Have you added a keys.js file as described in the readme?');
      }
      this.token = ko.observable((_ref = saved.token) != null ? _ref : null);
      this.username = ko.observable((_ref1 = saved.username) != null ? _ref1 : '');
      this.loggedIn = ko.observable(false);
      this.tokenExpired = ko.observable(false);
      this.timeline = ko.observable(null);
      this.apiCallCount = 0;
      this.vm = vm;
    }

    Auth.prototype.logOut = function() {
      this.loggedIn(false);
      this.token(null);
      this.username('');
      this.timeline(null);
      return this.vm.save();
    };

    Auth.prototype.addSig = function(values) {
      var k, key, keysAndValues, sortedKeys;

      sortedKeys = (function() {
        var _results;

        _results = [];
        for (k in values) {
          if (!__hasProp.call(values, k)) continue;
          _results.push(k);
        }
        return _results;
      })();
      sortedKeys.sort();
      keysAndValues = ((function() {
        var _i, _len, _results;

        _results = [];
        for (_i = 0, _len = sortedKeys.length; _i < _len; _i++) {
          key = sortedKeys[_i];
          _results.push(key + values[key]);
        }
        return _results;
      })()).join('');
      return values["api_sig"] = hex_md5(sharedSecret + keysAndValues);
    };

    Auth.prototype.redirectToRTM = function() {
      var qs, url;

      url = "http://www.rememberthemilk.com/services/auth/";
      qs = {
        api_key: apiKey,
        perms: "write"
      };
      this.addSig(qs);
      url += "?" + $.param(qs);
      return document.location = url;
    };

    Auth.prototype.ensureTimeline = function(callback) {
      var _this = this;

      if (this.timeline() == null) {
        return this.apiCall("rtm.timelines.create", {}, true, function(data) {
          _this.timeline(data.rsp.timeline);
          return callback();
        });
      } else {
        return callback();
      }
    };

    Auth.prototype.addTask = function(text, callback) {
      var _this = this;

      return this.ensureTimeline(function() {
        return _this.apiCall("rtm.tasks.add", {
          timeline: _this.timeline(),
          name: text,
          parse: 1
        }, true, callback);
      });
    };

    Auth.prototype.apiCall = function(method, params, authenticated, callback) {
      var functionName, head, script, url;

      url = "http://api.rememberthemilk.com/services/rest/";
      functionName = "rtmJsonp" + (new Date()).getTime() + "_" + this.apiCallCount;
      this.apiCallCount++;
      params = params != null ? params : {};
      params["format"] = "json";
      params["method"] = method;
      params["api_key"] = apiKey;
      params["callback"] = functionName;
      if (authenticated) {
        params["auth_token"] = this.token();
      }
      this.addSig(params);
      url += "?" + $.param(params);
      window[functionName] = function(data) {
        $("#" + functionName).remove();
        delete window[functionName];
        if (callback != null) {
          return callback(data);
        }
      };
      head = $('head')[0];
      script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = url;
      script.id = functionName;
      return head.appendChild(script);
    };

    Auth.prototype.populateFromFrob = function(frob) {
      var _this = this;

      return this.apiCall("rtm.auth.getToken", {
        frob: frob
      }, false, function(data) {
        if (data.rsp.stat === "ok") {
          _this.token(data.rsp.auth.token);
          _this.username(data.rsp.auth.user.username);
          _this.vm.save();
          return document.location = document.location.href.split("?")[0];
        } else {
          return _this.vm.fatalError('There was a problem getting a token from Remember the Milk: ' + data.rsp.err.msg);
        }
      });
    };

    Auth.prototype.checkToken = function(callback) {
      var _this = this;

      return this.apiCall("rtm.auth.checkToken", {
        auth_token: this.token()
      }, false, function(data) {
        if (data.rsp.stat === "ok") {
          _this.loggedIn(true);
        } else {
          _this.tokenExpired(true);
        }
        return callback();
      });
    };

    Auth.prototype.ensureToken = function(callback) {
      var frob;

      frob = getParameterByName('frob');
      if (frob !== "") {
        return this.populateFromFrob(frob);
      } else if ((this.token() != null) && (this.username() != null)) {
        return this.checkToken(callback);
      } else {
        return callback();
      }
    };

    Auth.prototype.toJSON = function() {
      var copy;

      copy = ko.toJS(this);
      delete copy.vm;
      delete copy.loggedIn;
      delete copy.tokenExpired;
      delete copy.timeline;
      delete copy.apiCallCount;
      return copy;
    };

    return Auth;

  })();

  ViewModel = (function() {
    function ViewModel(saved) {
      this.remove = __bind(this.remove, this);
      var list, _i, _len, _ref, _ref1,
        _this = this;

      this.lists = ko.observableArray();
      this.fatalError = ko.observable(null);
      this.auth = new Auth(this, (_ref = saved.auth) != null ? _ref : {});
      if (saved.lists != null) {
        _ref1 = saved.lists;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          list = _ref1[_i];
          this.lists.push(new List(this, list));
        }
      }
      this.loading = ko.observable(true);
      this.lists.subscribe(function() {
        return _this.save();
      });
    }

    ViewModel.prototype.load = function() {
      var _this = this;

      return this.auth.ensureToken(function() {
        return _this.loading(false);
      });
    };

    ViewModel.prototype.addList = function() {
      return this.lists.push(new List(this));
    };

    ViewModel.prototype.remove = function(list) {
      return this.lists.remove(list);
    };

    ViewModel.prototype.save = function() {
      return localStorage.setItem(storageKey, ko.toJSON(this));
    };

    ViewModel.prototype.toJSON = function() {
      var copy;

      copy = ko.toJS(this);
      delete copy.fatalError;
      delete copy.loading;
      return copy;
    };

    return ViewModel;

  })();

  saved = localStorage.getItem(storageKey);

  if (saved != null) {
    saved = JSON.parse(saved);
  } else {
    saved = {
      lists: [{}]
    };
  }

  vm = new ViewModel(saved);

  ko.applyBindings(vm);

  vm.load();

}).call(this);
