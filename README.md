This is a simple single page web app to add lists of tasks to Remember the Milk. If you're going to adapt and use it yourself you'll need to supply your own API key and secret. If you're happy to use a version on my server then you can access it at http://files.alnorth.com/rtm/index.html. No data is stored on my server, it's all saved using localStorage.

To use this you'll need to have a file in the same directory called keys.js with contents like this:

    var apiKey = "fkjbfekjbkebwkjbfkebwkfebkjbwf",
    	sharedSecret = "kjbwefkefwbjkkjefw";
