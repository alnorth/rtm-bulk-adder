storageKey = 'data-v2'

ko.bindingHandlers.showModal =
  init: (element, valueAccessor) ->,
  update: (element, valueAccessor) ->
    value = valueAccessor();
    if ko.utils.unwrapObservable(value)
      $(element).modal('show')
      # this is to focus input field inside dialog
      $("input", element).focus()
    else
      $(element).modal('hide')

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

class Auth
  constructor: (vm, saved) ->
    if window.apiKey? and window.sharedSecret?
      @rtm = new RTM(window.apiKey, window.sharedSecret)
    else
      vm.fatalError('apiKey and sharedSecret have not been defined. Have you added a keys.js file as described in the readme?')

    @token = ko.observable(saved.token ? null)
    @username = ko.observable(saved.username ? "")
    @loggedIn = ko.observable(false)
    @tokenExpired = ko.observable(false)
    @vm = vm

  populateFromFrob: (frob) ->
    @rtm.apiCall "rtm.auth.getToken", frob: frob, false, (data) =>
      if data.rsp.stat is "ok"
        @token(data.rsp.auth.token)
        @username(data.rsp.auth.user.username)

        @vm.save()

        # Go to this page without frob on the query string so that people won't bookmark it with the frob
        document.location = document.location.href.split("?")[0];
      else
        @vm.fatalError('There was a problem getting a token from Remember the Milk: ' + data.rsp.err.msg)

  checkToken: () ->
    @rtm.apiCall "rtm.auth.checkToken", auth_token: @token, false, (data) =>
      if data.rsp.stat is "ok"
        @loggedIn(true)
      else
        @tokenExpired(true)

  ensureToken: () ->
    frob = @rtm.getParameterByName('frob')
    if frob isnt ""
      this.populateFromFrob(frob)
    else if @token? and @username?
      this.checkToken()

  authenticateUser: () =>
    @rtm.authenticateUser()

  toJSON: () ->
    copy = ko.toJS(this)
    delete copy.vm
    delete copy.rtm
    copy

class ViewModel
  constructor: (saved) ->
    @lists = ko.observableArray()
    @fatalError = ko.observable(null)
    @auth = new Auth(this, saved.auth ? {})
    if saved.lists?
      for list in saved.lists
        @lists.push(new List(this, list))

    @loading = ko.computed(() => !(@auth.loggedIn() or @auth.tokenExpired()))

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
vm = new ViewModel(saved)
ko.applyBindings(vm)
vm.auth.ensureToken()