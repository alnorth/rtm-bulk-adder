(function() {
  var Auth, List, ViewModel, getParameterByName, migrateOldValues, saved, sortByKey, storageKey, timeSpan, trackEvent, vm,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  storageKey = 'data-v2';

  timeSpan = {
    second: 'seconds',
    seconds: 'seconds',
    minute: 'minutes',
    minutes: 'minutes',
    hour: 'hours',
    hours: 'hours',
    day: 'days',
    days: 'days',
    week: 'weeks',
    weeks: 'weeks',
    month: 'months',
    months: 'months',
    year: 'years',
    years: 'years'
  };

  sortByKey = function(array, key) {
    return array.sort(function(a, b) {
      var x, y;
      x = a[key];
      y = b[key];
      if (x < y) {
        return -1;
      } else {
        if (x > y) {
          return 1;
        } else {
          return 0;
        }
      }
    });
  };

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

  migrateOldValues = function() {
    var i, listCount, _ref, _ref1;
    listCount = localStorage.getItem('numberOfLists');
    if (listCount != null) {
      return {
        auth: {
          username: (_ref = localStorage.getItem('username')) != null ? _ref : '',
          token: (_ref1 = localStorage.getItem('token')) != null ? _ref1 : null
        },
        lists: (function() {
          var _i, _ref2, _results;
          _results = [];
          for (i = _i = 0, _ref2 = listCount - 1; 0 <= _ref2 ? _i <= _ref2 : _i >= _ref2; i = 0 <= _ref2 ? ++_i : --_i) {
            _results.push({
              text: localStorage.getItem('list' + i)
            });
          }
          return _results;
        })()
      };
    } else {
      return {
        lists: [{}]
      };
    }
  };

  trackEvent = function(category, action) {
    if (typeof _gaq !== "undefined" && _gaq !== null) {
      return _gaq.push(['_trackEvent', category, action]);
    }
  };

  String.prototype.regexIndexOf = function(regex, startpos) {
    var indexOf;
    indexOf = this.substring(startpos || 0).search(regex);
    if (indexOf >= 0) {
      return indexOf + (startpos || 0);
    } else {
      return indexOf;
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
      this.setStartPointToDefault = __bind(this.setStartPointToDefault, this);
      this.clearStartPoint = __bind(this.clearStartPoint, this);
      this.setRtmListToDefault = __bind(this.setRtmListToDefault, this);
      this.clearRtmList = __bind(this.clearRtmList, this);
      this.send = __bind(this.send, this);
      this.canSend = __bind(this.canSend, this);
      this.parseDateDiff = __bind(this.parseDateDiff, this);
      var _ref,
        _this = this;
      if (saved == null) {
        saved = {};
      }
      this.text = ko.observable((_ref = saved.text) != null ? _ref : "");
      this.rtmList = ko.observable();
      if (saved.rtmList != null) {
        vm.rtmLists.subscribe(function(newValue) {
          return _this.rtmList(ko.utils.arrayFirst(newValue, function(l) {
            return l.id === saved.rtmList;
          }));
        });
      }
      this.startPoint = ko.observable(saved.startPoint);
      this.startPointDate = ko.computed(function() {
        var sp;
        vm.seconds();
        sp = _this.startPoint();
        if (sp) {
          return date(sp);
        }
      });
      this.startPointDateString = ko.computed(function() {
        var d;
        d = _this.startPointDate();
        if (d) {
          return moment(d).format('YYYY-MM-DD HH:mm');
        } else {
          return 'Invalid date';
        }
      });
      this.linesToSend = ko.computed(function() {
        var l, _i, _len, _ref1, _results;
        _ref1 = _this.text().split('\n');
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          l = _ref1[_i];
          _results.push(_this.processLine(l));
        }
        return _results;
      });
      this.combinedErrors = ko.computed(function() {
        var errors, l, _i, _len, _ref1;
        errors = [];
        _ref1 = _this.linesToSend();
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          l = _ref1[_i];
          errors = errors.concat(l.errors);
        }
        return errors;
      });
      this.sending = ko.observable(false);
      this.vm = vm;
      this.text.subscribe(function(newValue) {
        return vm.save();
      });
      this.rtmList.subscribe(function(newValue) {
        return vm.save();
      });
      this.startPoint.subscribe(function(newValue) {
        return vm.save();
      });
    }

    List.prototype.addToDuration = function(num, type, duration) {
      var translated;
      translated = timeSpan[type];
      if (translated) {
        return duration[translated] = num;
      } else {
        throw new Error("Timespan \"" + type + "\" is not supported.");
      }
    };

    List.prototype.parseDateDiff = function(text) {
      var dt, duration, match, multiplier, regex;
      dt = moment(this.startPointDate());
      multiplier = text[2] === '-' ? -1 : 1;
      duration = {};
      regex = /(\d+)\s*(\w+)/gi;
      while (match = regex.exec(text)) {
        this.addToDuration(multiplier * parseInt(match[1]), match[2], duration);
      }
      return dt.add(duration).format('YYYY-MM-DD HH:mm');
    };

    List.prototype.processLine = function(line) {
      var err, errors, formatted;
      formatted = $.trim(line);
      errors = [];
      try {
        if (this.startPoint() && this.startPointDate()) {
          if (formatted.regexIndexOf(/#{[^}]*$/g) >= 0) {
            errors.push("Unclosed \#{} tag");
          }
          formatted = formatted.replace(/#{[^}]*}/g, this.parseDateDiff);
        } else {
          if (formatted.regexIndexOf(/#{[^}]*}/g) >= 0) {
            errors.push("Contains \#{} tag but has no start point set");
          }
        }
      } catch (_error) {
        err = _error;
        errors.push(err.message);
      }
      return {
        line: formatted,
        errors: errors
      };
    };

    List.prototype.sendLine = function(line, callback) {
      var listId;
      listId = this.rtmList() ? this.rtmList().id : null;
      return this.vm.auth.addTask(line, listId, function(data) {
        if (data.rsp.stat === "ok") {
          return callback();
        }
      });
    };

    List.prototype.canSend = function() {
      return (!this.startPoint() || this.startPointDate()) && this.combinedErrors().length === 0;
    };

    List.prototype.send = function() {
      var lines, sendTask,
        _this = this;
      if (!this.sending()) {
        trackEvent('Task Set', 'Send');
        lines = this.linesToSend();
        sendTask = function(index) {
          var task;
          if (index < lines.length) {
            task = lines[index].line;
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

    List.prototype.clearRtmList = function() {
      return this.rtmList(null);
    };

    List.prototype.setRtmListToDefault = function() {
      return this.rtmList(vm.rtmLists()[0]);
    };

    List.prototype.clearStartPoint = function() {
      return this.startPoint(null);
    };

    List.prototype.setStartPointToDefault = function() {
      return this.startPoint('Now');
    };

    List.prototype.toJSON = function() {
      var copy;
      copy = ko.toJS(this);
      delete copy.vm;
      delete copy.sending;
      if (copy.rtmList != null) {
        copy.rtmList = copy.rtmList.id;
      }
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

    Auth.prototype.addTask = function(text, listId, callback) {
      var _this = this;
      return this.ensureTimeline(function() {
        var args;
        args = {
          timeline: _this.timeline(),
          name: text,
          parse: 1
        };
        if (listId && listId !== '0') {
          args.list_id = listId;
        }
        return _this.apiCall("rtm.tasks.add", args, true, callback);
      });
    };

    Auth.prototype.getListOfLists = function(callback) {
      return this.apiCall('rtm.lists.getList', {}, true, callback);
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
        this.loggedIn(false);
        return this.vm.loading(false);
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
      this.rtmLists = ko.observableArray();
      this.fatalError = ko.observable(null);
      this.auth = new Auth(this, (_ref = saved.auth) != null ? _ref : {});
      this.seconds = ko.observable();
      setInterval((function() {
        return _this.seconds(moment().format('mm:ss'));
      }), 10000);
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

    ViewModel.prototype.loadListsFromRtm = function(callback) {
      var _this = this;
      return this.auth.getListOfLists(function(data) {
        var filtered;
        if (data.rsp.stat === 'ok') {
          filtered = ko.utils.arrayFilter(data.rsp.lists.list, function(l) {
            return l.archived === '0' && l.locked === '0' && l.smart === '0';
          });
          filtered = sortByKey(filtered, 'name');
          filtered.unshift({
            name: 'Inbox',
            id: '0'
          });
          _this.rtmLists(filtered);
          return callback();
        } else {
          return _this.fatalError('There was a problem fetching your lists from Remember the Milk: ' + data.rsp.err.msg);
        }
      });
    };

    ViewModel.prototype.load = function() {
      var _this = this;
      return this.auth.ensureToken(function() {
        return _this.loadListsFromRtm(function() {
          return _this.loading(false);
        });
      });
    };

    ViewModel.prototype.addList = function() {
      trackEvent('Task Set', 'Add');
      return this.lists.push(new List(this));
    };

    ViewModel.prototype.remove = function(list) {
      trackEvent('Task Set', 'Remove');
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
      delete copy.rtmLists;
      return copy;
    };

    return ViewModel;

  })();

  saved = localStorage.getItem(storageKey);

  if (saved != null) {
    saved = JSON.parse(saved);
  } else {
    saved = migrateOldValues();
  }

  vm = new ViewModel(saved);

  ko.applyBindings(vm);

  vm.load();

  $(document).on('click', '[data-modal]', function() {
    var modalId;
    modalId = $(this).attr('data-modal');
    return $("\#" + modalId).modal('show');
  });

}).call(this);
