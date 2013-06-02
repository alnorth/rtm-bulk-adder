class List
  constructor: ->
    @text = ko.observable("")
    @sending = ko.observable(false)

  send: ->
    if !@sending()
      @sending(true)
      console.log "sending"

class ViewModel
  constructor: ->
    @lists = ko.observableArray()

  addList: ->
    console.log "add", arguments
    @lists.push(new List())

  remove: (list) =>
    console.log "remove", arguments
    console.log list, @lists
    @lists.remove(list)

ko.applyBindings(new ViewModel())