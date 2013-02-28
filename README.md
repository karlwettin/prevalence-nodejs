prevalence-nodejs
=================

System prevalence (<http://en.wikipedia.org/wiki/System_Prevalence>) for Node.js

This is version 0.1-SNAPSHOT and is the first thing I've ever written
for Node.js so be aware, most probably here be dragons!

Acknowledgements
================

The serializer use code from <https://github.com/jdknezek/json-ref> with
authorization of its author Jonathan D. Knezek.

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
