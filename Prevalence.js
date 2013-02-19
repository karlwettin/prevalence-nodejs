exports.factory = function factory(path, initialState) {
  return new Prevalence(new FileSystemIO(new JsonRefSerializer(), path), initialState);
};

exports.Prevalence = Prevalence;
exports.FileSystemIO = FileSystemIO;
exports.JsonRefSerializer = JsonRefSerializer;

function Prevalence(io, initialState) {

  var self = this;
  this.io = io;
  this.root = null;

  /**
   *
   * @param transaction  { execute : function(root, executionTime){}, fields : {} }
   * @param transactionExecutedClosure function(transaction#execute():return value
   * @return {*}
   */
  this.execute = function execute(transaction, transactionExecutedClosure) {

    // create new deep clone
    // to make sure the transaction is executed the same way as when loaded from journal
    transaction = { execute: eval("f=" + transaction.execute + ";"), fields: transaction.fields === null || typeof transaction.fields === 'undefined' ? null : JSON.parse(JSON.stringify(transaction.fields))};

    return self.io.executeWriteLocked(function execute() {
      self.io.addTransactionToJournal(transaction, function transactionAppendedClosure(executionTime) {
        var results = transaction.execute(self.root, executionTime);
        transactionExecutedClosure(results);
      });
    });
  };

  this.query = function query(query) {
    return self.io.executeReadLocked(function () {
      return query.execute(self.root);
    });
  };

  /**
   * @param snapshotWrittenClosure function(executionTime);
   */
  this.takeSnapshot = function takeSnapshot(snapshotWrittenClosure) {
    self.io.takeSnapshot(self.root, snapshotWrittenClosure);
  };


  this.open = function open(openedClosure) {
    self.io.open(function () {
      self.io.readSnapshot(
        initialState,
        0,
        function snapshotReadClosure(root) {
          self.root = root;
          self.io.readTransactions(self.io.getSnapshotTimeStamp(),
            function transactionClosure(transaction, executionTime) {
              transaction.execute(self.root, executionTime);
            },
            openedClosure
          );

        });
    });

  };


  this.end = function end() {
    self.io.end();
  };

  this.toString = function toString() {
    return "[Prevalence]";
  };
}



function FileSystemIO(serializer, directory) {

  var self = this;
  this.serializer = serializer;

  this.directory = directory;
  this.snapshotTimeStamp = 0;
  this.journalFile = null;

  this.open = function open(openedClosure) {
    if (!require('fs').existsSync(directory)) {
      require('fs').mkdirSync(directory);
    }
    openedClosure();
  };

  this.end = function end() {
  };


  this.executeWriteLocked = function executeWriteLocked(closure) {
    return closure();
  };

  this.executeReadLocked = function executeReadLocked(closure) {
    return closure();
  };

  this.addTransactionToJournal = function addTransactionToJournal(transaction, transactionAppendedClosure) {

    var executionTime = self.journalFile !== null && typeof self.journalFile !== 'undefined' ? this.getTime() : createJournal();

    var execute = transaction.execute.toString();
    if (execute.indexOf("function (") == 0) {
      execute = execute.substring("function (".length);
      execute = "function execute(" + execute;
    }
    var json = JSON.stringify({transaction: { execute: execute, fields: transaction.fields}, executionTime: executionTime});
    console.log("Adding new transaction to journal. " + json);

    require('fs').appendFile(self.journalFile, new Buffer(json + "\n", "utf8"), function () {
      transactionAppendedClosure(executionTime);
    });


  };

  function createJournal() {
    // loop avoids overwriting in case we close and open really fast
    var executionTime = self.getTime();
    while (true) {
      self.journalFile = directory + "/" + executionTime + ".journal";
      if (!require('fs').existsSync(self.journalFile)) {
        break;
      }
      // todo this might actually be an error!
      executionTime++;
    }
    console.log("Creating new transaction journal " + self.journalFile);
    return executionTime;
  }

  this.getSnapshotTimeStamp = function getSnapshotTimeStamp() {
    return this.snapshotTimeStamp;
  };

  /**
   * @param root
   * @param snapshotWrittenClosure function(executionDate)
   */
  this.takeSnapshot = function takeSnapshot(root, snapshotWrittenClosure) {
    var self = this;
    var executionTime = this.getTime();
    var snapshot = require('./json-ref.js').ref(root);
    var snapshotFileName = executionTime + ".snapshot";
    require('fs').writeFile(directory + "/" + snapshotFileName, JSON.stringify(snapshot), "utf8", function () {
      if (self.journalFile !== null && self.journalFile !== 'undefined') {
        self.journalFile.end();
        self.journalFile = null;
      }
      self.snapshotTimeStamp = executionTime;
      snapshotWrittenClosure(executionTime);
    });

  };

  this.readSnapshot = function readSnapshot(initialState, sinceExecutionTime, snapshotReadClosure) {

    sinceExecutionTime = typeof sinceExecutionTime !== 'undefined' ? sinceExecutionTime : 0;

    var snapshots = new Array();
    var fileNames = require('fs').readdirSync(this.directory)
    for (var i in fileNames) {
      var fileName = fileNames[i];
      // todo regexp "^([0-9]+).snapshot"
      if (endsWith(fileName, ".snapshot")) {
        console.log("Detected snapshot file " + fileName);
        var startExecutionTime = parseInt(fileName.substring(0, fileName.indexOf(".snapshot")));
        if (startExecutionTime >= sinceExecutionTime) {
          snapshots.push({startExecutionTime: startExecutionTime, fileName: fileName, filePath: directory + "/" + fileName});
          console.log("Gathering snapshot file " + fileName);
        }
      }
    }
    snapshots.sort(function (a, b) {
      return a.startExecutionTime - b.startExecutionTime;
    });


    if (snapshots.length < 1) {
      console.log("No snapshot files found, using initial state as root.");

      self.snapshotTimeStamp = 0;

      var initialStateClone = self.serializer.cloneInitialState(initialState);
      snapshotReadClosure(initialStateClone);


    } else {
      var snapshot = snapshots[snapshots.length - 1];
      console.log("Selecting snapshot file " + snapshot.fileName);


      var readStream = require('fs').createReadStream(snapshot.filePath, {
        flags: 'r',
        encoding: 'utf-8',
        fd: null,
        mode: 0666,
        bufferSize: 64 * 1024
      });

      self.serializer.readSnapshot(readStream, function (root) {
        self.snapshotTimeStamp = snapshot.startExecutionTime;
        console.log("Read snapshot file " + snapshot.fileName);
        snapshotReadClosure(root);
      });


    }


  };

  /**
   *
   * @param sinceExecutionTime
   * @param transactionClosure function(transaction, executionTime):boolean abort
   * @param endJournalsClosure
   */
  this.readTransactions = function readTransactions(sinceExecutionTime, transactionClosure, endJournalsClosure) {

    console.log("Replaying transaction log since " + sinceExecutionTime);

    var journals = [];
    var fileNames = require('fs').readdirSync(this.directory);
    for (var i in fileNames) {
      var fileName = fileNames[i];
      // todo regexp "^([0-9]+).journal$"
      if (endsWith(fileName, ".journal")) {
        console.log("Found transaction journal " + fileName);
        var startExecutionTime = parseInt(fileName.substring(0, fileName.indexOf(".journal")));
        if (startExecutionTime >= sinceExecutionTime) {
          journals.push({startExecutionTime: startExecutionTime, fileName: fileName, filePath: this.directory + "/" + fileName});
          console.log("Gathering transaction journal " + fileName);
        }
      }
    }

    if (journals.length == 0) {

      endJournalsClosure();

    } else {

      console.log(journals.length + " transaction journals gathered.");

      journals.sort(function (a, b) {
        return a.startExecutionTime - b.startExecutionTime;
      });

      var transactionCounter = 0;

      function readNextJournal(journals, journalsIndex) {

        var journal = journals[journalsIndex];

        console.log("Loading transaction journal " + journal.fileName);

        var fs = require('fs');

        var stream = fs.createReadStream(journal.filePath, {
          flags: 'r',
          encoding: 'utf-8',
          fd: null,
          mode: 0666,
          bufferSize: 64 * 1024
        });

        var fileData = '';


        console.log("Opened transaction journal " + journal.fileName);

        function readJournalEntries() {

          while (true) {
            var indexOfLf = fileData.indexOf('\n');
            if (indexOfLf < 0) {
              break;
            } else {

              var line = fileData.substring(0, indexOfLf);
              fileData = fileData.substr(indexOfLf + 1);

              if (line.trim() !== "") {
                var entry = JSON.parse(line);
                var execute = eval("f=" + entry.transaction.execute + ";");
                var transaction = {execute: execute, fields: entry.transaction.fields};
                transactionClosure(transaction, entry.executionTime);
                transactionCounter++;
              }
            }
          }
        }

        stream.on('data', function (data) {
          fileData += data;
          readJournalEntries();
        });

        stream.on('error', function () {
          throw "Error while reading journal stream!";
        });

        stream.on('end', function () {
          readJournalEntries();
          console.log("End of transaction journal " + journal.fileName);

          if (journalsIndex < journals.length -1) {
            readNextJournal(journals, ++journalsIndex);
          } else {
            console.log(transactionCounter + " transactions executed.");
            endJournalsClosure();
          }
        });


      }

      readNextJournal(journals, 0);
    }
  };

  this.getTime = function getTime() {
    return new Date().getTime();
  };

  this.toString = function toString() {
    return "[FileSystemIO]";
  };


}


function JsonRefSerializer() {
  /**
   *
   * @param object
   * @param writeStream
   * @param serializedClosure function()
   */
  this.writeSnapshot = function writeSnapshot(object, writeStream, serializedClosure) {
    var serializedObject = JSON.stringify(require('./json-ref.js').ref(object));
    writeStream.write(new Buffer(serializedObject, "utf8"));
    serializedClosure();
  };

  /**
   *
   * @param readStream
   * @param deserializedClosure function(deserializedObject)
   */
  this.readSnapshot = function readSnapshot(readStream, deserializedClosure) {
    var dataRead = '';
    readStream.on('data', function (data) {
      dataRead += data;
    });
    readStream.on('end', function () {
      var deserializedObject = require('./json-ref.js').deref(JSON.parse(dataRead));
      deserializedClosure(deserializedObject);
    });
  };

  this.cloneInitialState = function cloneInitialState(initialState) {
    var serializedObject = JSON.stringify(require('./json-ref.js').ref(initialState));
    var deserializedObject = require('./json-ref.js').deref(JSON.parse(serializedObject));
    return deserializedObject;
  };

  this.toString = function toString() {
    return "[JsonRefSerializer]";
  };
}

// utils

function endsWith(string, suffix) {
  return string.indexOf(suffix, string.length - suffix.length) !== -1;
}
