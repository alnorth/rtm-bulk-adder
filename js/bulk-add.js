(function() {
  var List, ViewModel,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  List = (function() {
    function List() {
      this.text = ko.observable("");
      this.sending = ko.observable(false);
    }

    List.prototype.send = function() {
      if (!this.sending()) {
        this.sending(true);
        return console.log("sending");
      }
    };

    return List;

  })();

  ViewModel = (function() {
    function ViewModel() {
      this.remove = __bind(this.remove, this);      this.lists = ko.observableArray();
    }

    ViewModel.prototype.addList = function() {
      console.log("add", arguments);
      return this.lists.push(new List());
    };

    ViewModel.prototype.remove = function(list) {
      console.log("remove", arguments);
      console.log(list, this.lists);
      return this.lists.remove(list);
    };

    return ViewModel;

  })();

  ko.applyBindings(new ViewModel());

}).call(this);
