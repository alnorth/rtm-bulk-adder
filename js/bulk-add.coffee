storageKey = 'data-v2'

getParameterByName = (name)->
    name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]')
    regexS = '[\\?&]' + name + '=([^&#]*)'
    regex = new RegExp(regexS)
    results = regex.exec(window.location.href)

    if results? then decodeURIComponent(results[1].replace(/\+/g, ' ')) else ''

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
    saved ?= {}
    @text = ko.observable(saved.text ? "")
    @sending = ko.observable(false)
    @vm = vm
    @text.subscribe((newValue) -> vm.save())

  sendLine: (line, callback) ->
    @vm.auth.addTask line, (data) ->
      if data.rsp.stat is "ok"
        callback()

  send: =>
    if !@sending()
      lines = @text().split('\n')
      sendTask = (index) =>
        if index < lines.length
          task = $.trim(lines[index])

          if task.length > 0
            @sendLine task, ->
              sendTask index + 1, length
          else
            sendTask index + 1, length
        else
          # We're done
          @sending false
    
    @sending true
    sendTask 0

  toJSON: () ->
    copy = ko.toJS(this)
    delete copy.vm
    delete copy.sending
    copy

class Auth
  constructor: (vm, saved) ->
    if not (window.apiKey? and window.sharedSecret?)
      vm.fatalError('apiKey and sharedSecret have not been defined. Have you added a keys.js file as described in the readme?')

    @token = ko.observable(saved.token ? null)
    @username = ko.observable(saved.username ? '')
    @loggedIn = ko.observable(false)
    @tokenExpired = ko.observable(false)
    @timeline = ko.observable(null)
    @apiCallCount = 0
    @vm = vm

  logOut: =>
    @loggedIn(false)
    @token(null)
    @username('')
    @timeline(null)

    @vm.save()

  addSig: (values) ->
    sortedKeys = (k for own k of values)
    sortedKeys.sort()
    keysAndValues = (key + values[key] for key in sortedKeys).join('')

    values["api_sig"] = hex_md5(sharedSecret + keysAndValues);

  redirectToRTM: () =>
    url = "http://www.rememberthemilk.com/services/auth/"
    qs = api_key: apiKey, perms: "write"

    @addSig(qs);
    url += "?" + $.param(qs)

    document.location = url

  ensureTimeline: (callback) ->
    if not @timeline()?
      @apiCall "rtm.timelines.create", {}, true, (data) =>
        @timeline(data.rsp.timeline)
        callback()
    else
      callback()
  
  addTask: (text, callback) ->
    @ensureTimeline =>
      @apiCall("rtm.tasks.add", {timeline: @timeline(), name: text, parse: 1}, true, callback)

  apiCall: (method, params, authenticated, callback) ->
    url = "http://api.rememberthemilk.com/services/rest/"
    functionName = "rtmJsonp" + (new Date()).getTime() + "_" + @apiCallCount

    @apiCallCount++
    
    params = params ? {}
    params["format"] = "json"
    params["method"] = method
    params["api_key"] = apiKey
    params["callback"] = functionName
    if authenticated
      params["auth_token"] = @token()
    
    @addSig(params)
    url += "?" + $.param(params)
    
    window[functionName] = (data) ->
      $("#" + functionName).remove()
      delete window[functionName]
      if callback?
        callback data
    
    head = $('head')[0]
    script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = url
    script.id = functionName
    
    head.appendChild(script)

  populateFromFrob: (frob) ->
    @apiCall "rtm.auth.getToken", frob: frob, false, (data) =>
      if data.rsp.stat is "ok"
        @token(data.rsp.auth.token)
        @username(data.rsp.auth.user.username)

        @vm.save()

        # Go to this page without frob on the query string so that people won't bookmark it with the frob
        document.location = document.location.href.split("?")[0];
      else
        @vm.fatalError('There was a problem getting a token from Remember the Milk: ' + data.rsp.err.msg)

  checkToken: () ->
    @apiCall "rtm.auth.checkToken", auth_token: @token(), false, (data) =>
      if data.rsp.stat is "ok"
        @loggedIn(true)
      else
        @tokenExpired(true)

  ensureToken: () ->
    frob = getParameterByName('frob')
    if frob isnt ""
      @populateFromFrob(frob)
    else if @token()? and @username()?
      @checkToken()

  toJSON: () ->
    copy = ko.toJS(this)
    delete copy.vm
    delete copy.loggedIn
    delete copy.tokenExpired
    delete copy.timeline
    delete copy.apiCallCount
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

  toJSON: () ->
    copy = ko.toJS(this)
    delete copy.fatalError
    delete copy.loading
    copy


saved = localStorage.getItem(storageKey)
if saved?
  saved = JSON.parse(saved)
else
  saved = {}
vm = new ViewModel(saved)
ko.applyBindings(vm)
vm.auth.ensureToken()