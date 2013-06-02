(function() {
  var Auth, List, ViewModel, saved, storageKey, vm,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  storageKey = 'data-v2';

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
      var _ref;

      console.log(saved);
      if (saved == null) {
        saved = {};
      }
      this.text = ko.observable((_ref = saved.text) != null ? _ref : "");
      this.sending = ko.observable(false);
      this.text.subscribe(function(newValue) {
        return vm.save();
      });
    }

    List.prototype.send = function() {
      if (!this.sending()) {
        return this.sending(true);
      }
    };

    return List;

  })();

  Auth = (function() {
    function Auth(vm, saved) {
      this.authenticateUser = __bind(this.authenticateUser, this);
      var _ref, _ref1;

      if ((window.apiKey != null) && (window.sharedSecret != null)) {
        this.rtm = new RTM(window.apiKey, window.sharedSecret);
      } else {
        vm.fatalError('apiKey and sharedSecret have not been defined. Have you added a keys.js file as described in the readme?');
      }
      this.token = ko.observable((_ref = saved.token) != null ? _ref : null);
      this.username = ko.observable((_ref1 = saved.username) != null ? _ref1 : "");
      this.loggedIn = ko.observable(false);
      this.tokenExpired = ko.observable(false);
      this.vm = vm;
    }

    Auth.prototype.populateFromFrob = function(frob) {
      var _this = this;

      return this.rtm.apiCall("rtm.auth.getToken", {
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

    Auth.prototype.checkToken = function() {
      var _this = this;

      return this.rtm.apiCall("rtm.auth.checkToken", {
        auth_token: this.token
      }, false, function(data) {
        if (data.rsp.stat === "ok") {
          return _this.loggedIn(true);
        } else {
          return _this.tokenExpired(true);
        }
      });
    };

    Auth.prototype.ensureToken = function() {
      var frob;

      frob = this.rtm.getParameterByName('frob');
      if (frob !== "") {
        return this.populateFromFrob(frob);
      } else if ((this.token != null) && (this.username != null)) {
        return this.checkToken();
      }
    };

    Auth.prototype.authenticateUser = function() {
      return this.rtm.authenticateUser();
    };

    Auth.prototype.toJSON = function() {
      var copy;

      copy = ko.toJS(this);
      delete copy.vm;
      delete copy.rtm;
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
      this.loading = ko.computed(function() {
        return !(_this.auth.loggedIn() || _this.auth.tokenExpired());
      });
    }

    ViewModel.prototype.addList = function() {
      return this.lists.push(new List(this));
    };

    ViewModel.prototype.remove = function(list) {
      return this.lists.remove(list);
    };

    ViewModel.prototype.save = function() {
      return localStorage.setItem(storageKey, ko.toJSON(this));
    };

    return ViewModel;

  })();

  saved = localStorage.getItem(storageKey);

  if (saved != null) {
    saved = JSON.parse(saved);
  } else {
    saved = {};
  }

  vm = new ViewModel(saved);

  ko.applyBindings(vm);

  vm.auth.ensureToken();

}).call(this);
