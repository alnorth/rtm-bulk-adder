storageKey = 'data-v2'

class List
  constructor: (vm, saved) ->
    console.log saved
    saved ?= {}
    @text = ko.observable(saved.text ? "")
    @sending = ko.observable(false)

    @text.subscribe((newValue) -> vm.save())

  send: ->
    if !@sending()
      @sending(true)

class ViewModel
  constructor: (saved) ->
    @lists = ko.observableArray()
    if saved? and saved.lists?
      for list in saved.lists
        @lists.push(new List(this, list))

  addList: ->
    @lists.push(new List(this))

  remove: (list) =>
    @lists.remove(list)

  save: ->
    localStorage.setItem(storageKey, ko.toJSON(this))

saved = localStorage.getItem(storageKey)
if saved?
  saved = JSON.parse(saved)
else
  saved = {}
ko.applyBindings(new ViewModel(saved))