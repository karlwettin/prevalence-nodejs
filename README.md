prevalence-nodejs
=================

System prevalence (<http://en.wikipedia.org/wiki/System_Prevalence>) for Node.js

This is version 0.1-SNAPSHOT and is the first thing I've ever written
for Node.js so be aware, most probably here be dragons!

Requirements
============

The serializer use JSON-REF which allows for circular references, but
due to missing license information in the implementation I've found
you'll have to compile <https://github.com/jdknezek/json-ref> to
Javascript and save it as json-ref.js in the same directory as
Prevalene.js. I've emailed the author and asked for permission to
merge the code with function JsonRefSerializer.

```
sudo apt-get install coffeescript
git clone https://github.com/jdknezek/json-ref.git
coffee -c json-ref/lib/json-ref.coffee
cp json-ref/lib/json-ref.js $PREVALANCE_HOME
```

Caveats
=======

* Prevalance base and aggregates must only contain plain field data.
Any function, proto, etc will be lost in time. This is due to snapshot
serialization, i.e. it works fine if you never take a snapshot and
purely live out of the transaction journals.

* It's not possible to scale applications (i.e. running multiple
instances of Node.js that use the same prevalent system) since the IO
lack locking mechanism and a way to report back to other instances
that some transaction has been executed.

It would be nice to solve these problems. I've got a few ideas and
might just do something about it in the future.
