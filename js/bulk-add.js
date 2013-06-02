(function() {
  var List, ViewModel, saved, storageKey,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  storageKey = 'data-v2';

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

  ViewModel = (function() {
    function ViewModel(saved) {
      this.remove = __bind(this.remove, this);
      var list, _i, _len, _ref;

      this.lists = ko.observableArray();
      if ((saved != null) && (saved.lists != null)) {
        _ref = saved.lists;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          list = _ref[_i];
          this.lists.push(new List(this, list));
        }
      }
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

  ko.applyBindings(new ViewModel(saved));

}).call(this);
