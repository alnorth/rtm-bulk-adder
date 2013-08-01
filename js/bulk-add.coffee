storageKey = 'data-v2'

sortByKey = (array, key) ->
  array.sort (a, b) ->
    x = a[key]
    y = b[key]
    if x < y then -1 else (if x > y then 1 else 0)

getParameterByName = (name) ->
  name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]')
  regexS = '[\\?&]' + name + '=([^&#]*)'
  regex = new RegExp(regexS)
  results = regex.exec(window.location.href)

  if results? then decodeURIComponent(results[1].replace(/\+/g, ' ')) else ''

migrateOldValues = ->
  listCount = localStorage.getItem('numberOfLists')
  if listCount?
    auth:
      username: localStorage.getItem('username') ? ''
      token: localStorage.getItem('token') ? null
    lists: text: localStorage.getItem('list' + i) for i in [0..(listCount - 1)]
  else
    lists: [{}]

trackEvent = (category, action) ->
  if _gaq?
    _gaq.push(['_trackEvent', category, action])

String.prototype.regexIndexOf = (regex, startpos) ->
    indexOf = @substring(startpos || 0).search(regex)
    if (indexOf >= 0) then (indexOf + (startpos || 0)) else indexOf

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

    @rtmList = ko.observable()
    # Load the right RTM list once they've been fetched
    if saved.rtmList?
      vm.rtmLists.subscribe (newValue) =>
        @rtmList ko.utils.arrayFirst(newValue, (l) -> l.id is saved.rtmList)

    @startPoint = ko.observable(saved.startPoint)
    @startPointDate = ko.computed =>
      vm.seconds() # Triggers updates of this computed every ten seconds
      sp = @startPoint()
      if sp
        date sp
    @startPointDateString = ko.computed =>
      d = @startPointDate()
      if d
        moment(d).format('YYYY-MM-DD HH:mm')
      else
        'Invalid date'

    @linesToSend = ko.computed =>
      @processLine(l) for l in @text().split('\n')
    @combinedErrors = ko.computed =>
      errors = []
      errors = errors.concat(l.errors) for l in @linesToSend()
      errors
    
    @sending = ko.observable(false)
    @vm = vm
    
    @text.subscribe((newValue) -> vm.save())
    @rtmList.subscribe((newValue) -> vm.save())
    @startPoint.subscribe((newValue) -> vm.save())

  processLine: (line) ->
    formatted = $.trim(line)
    errors = []
    if @startPoint() and @startPointDate()
      if formatted.regexIndexOf(/#{[^}]*$/g) >= 0
        errors.push "Unclosed \#{} tag"
      formatted = formatted.replace /#{[^}]*}/g, (value) =>
        moment(@startPointDate()).format('YYYY-MM-DD HH:mm')
    else
      if formatted.regexIndexOf(/#{[^}]*}/g) >= 0
        errors.push "Contains \#{} tag but has no start point set"

    line: formatted, errors: errors

  sendLine: (line, callback) ->
    listId = if @rtmList() then @rtmList().id else null
    @vm.auth.addTask line, listId, (data) ->
      if data.rsp.stat is "ok"
        callback()

  canSend: =>
    # If we're using a start point then only allow sending when the date is valid
    (!@startPoint() || @startPointDate()) && @combinedErrors().length is 0

  send: =>
    if !@sending()
      trackEvent 'Task Set', 'Send'
      lines = @linesToSend()
      sendTask = (index) =>
        if index < lines.length
          task = lines[index].line

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

  clearRtmList: =>
    @rtmList(null)

  setRtmListToDefault: =>
    @rtmList(vm.rtmLists()[0])

  clearStartPoint: =>
    @startPoint(null)

  setStartPointToDefault: =>
    @startPoint('Now')

  toJSON: ->
    copy = ko.toJS(this)
    delete copy.vm
    delete copy.sending
    if copy.rtmList?
      copy.rtmList = copy.rtmList.id
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

  redirectToRTM: =>
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
  
  addTask: (text, listId, callback) ->
    @ensureTimeline =>
      args =
        timeline: @timeline(),
        name: text,
        parse: 1
      if listId and listId isnt '0'
        args.list_id = listId
      @apiCall("rtm.tasks.add", args, true, callback)

  getListOfLists: (callback) ->
    @apiCall('rtm.lists.getList', {}, true, callback)

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

  checkToken: (callback) ->
    @apiCall "rtm.auth.checkToken", auth_token: @token(), false, (data) =>
      if data.rsp.stat is "ok"
        @loggedIn(true)
      else
        @tokenExpired(true)
      callback()

  ensureToken: (callback) ->
    frob = getParameterByName('frob')
    if frob isnt ""
      @populateFromFrob(frob)
    else if @token()? and @username()?
      @checkToken(callback)
    else
      @loggedIn(false)
      @vm.loading(false)

  toJSON: ->
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
    @rtmLists = ko.observableArray()
    @fatalError = ko.observable(null)
    @auth = new Auth(this, saved.auth ? {})

    # Set up an observable that's constantly changing. We can then use this to trigger
    # updates of computed values.
    @seconds = ko.observable()
    setInterval (() => @seconds(moment().format('mm:ss'))), 10000

    if saved.lists?
      for list in saved.lists
        @lists.push(new List(this, list))

    @loading = ko.observable(true)

    @lists.subscribe(=> @save())

  loadListsFromRtm: (callback) ->
    @auth.getListOfLists (data) =>
      if data.rsp.stat is 'ok'
        
        filtered = ko.utils.arrayFilter data.rsp.lists.list, (l) ->
          l.archived is '0' and l.locked is '0' and l.smart is '0'
        filtered = sortByKey filtered, 'name'
        
        # Inbox will have been filtered out as it is marked as locked. Readd it at the top.
        filtered.unshift name: 'Inbox', id: '0'

        @rtmLists(filtered)
        callback()
      else
        @fatalError('There was a problem fetching your lists from Remember the Milk: ' + data.rsp.err.msg)

  load: ->
    @auth.ensureToken () =>
      @loadListsFromRtm () =>
        @loading false

  addList: ->
    trackEvent 'Task Set', 'Add'
    @lists.push(new List(this))

  remove: (list) =>
    trackEvent 'Task Set', 'Remove'
    @lists.remove(list)

  save: ->
    localStorage.setItem(storageKey, ko.toJSON(this))

  toJSON: ->
    copy = ko.toJS(this)
    delete copy.fatalError
    delete copy.loading
    delete copy.rtmLists
    copy


saved = localStorage.getItem(storageKey)
if saved?
  saved = JSON.parse(saved)
else
  # migrateOldValues will either load values from a previous version, or give an empty object.
  saved = migrateOldValues()
vm = new ViewModel(saved)
ko.applyBindings(vm)
vm.load()