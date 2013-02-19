
var directory = new Date().getTime() + ".prevalence";

var initialState = {"state": "initial root"};


var prevalence = require('./Prevalence.js').factory(directory, initialState);
prevalence.open(function opened() {

    console.log("Prevalence opened.");

    assertEquals("initial root", prevalence.root.state);


    prevalence.execute({
      fields: { key: "value"},
      execute: function assertTransactionWithFields(root, executionTime) {
        return this.fields.key;
      }
    }, function (results) {
      assertEquals("value", results, "assertTransactionWithFields");
    });

    prevalence.execute({
      execute: function assertTransactionReturnValue(root, executionTime) {
        return "2";
      }
    }, function (results) {
      assertEquals("2", results, "assertTransactionReturnValue");
    });


    prevalence.execute({
      execute: function assertTransactionWithoutFields(root, executionTime) {
        return "1";
      }
    }, function (results) {
      assertEquals("1", results, "assertTransactionWithoutFields");
    });


    prevalence.execute({
      execute: function (root, executionTime) {
        return "unnamed transaction function";
      }
    }, function (results) {
      assertEquals("unnamed transaction function", results, "unnamed transaction function");
    });


    prevalence.execute({
      execute: function assertUpdateState(root, executionTime) {
        root.state = "updated";
      }
    }, function (results) {
      assertEquals("updated", prevalence.root.state, "assertTransactionWithFields");
      assertEquals("initial root", initialState.state, "initial state should never change, root is a clone of it!");
    });


    prevalence.execute({
      execute: function setStartedTimeInRoot(root, executionTime) {
        return root.started = executionTime;
      }
    }, function (started) {

      assertEquals(prevalence.root.started, started, "Started does not equals");
      assertEquals("updated", prevalence.root.state, "state does not match");

      prevalence.end();

      console.log("Prevalence closed. Re-opening 1...");
      prevalence = require('./Prevalence.js').factory(directory, initialState);
      prevalence.open(function opened() {
        console.log("Prevalence re-opened 1.");
        assertEquals("updated", prevalence.root.state, "state does not match");
        assertEquals(prevalence.root.started, started, "Started does not equals after re-open and loading journal");

        prevalence.execute({
          execute: function assertUpdateState(root, executionTime) {
            root.state = "updated 2";
          }
        }, function (results) {
          assertEquals("updated 2", prevalence.root.state, "assertTransactionWithFields");
          assertEquals("initial root", initialState.state, "initial state should never change, root is a clone of it!");


          prevalence.end();

          console.log("Prevalence closed. Re-opening 2...");
          prevalence = require('./Prevalence.js').factory(directory, initialState);
          prevalence.open(function opened() {
            console.log("Prevalence re-opened 2.");
            assertEquals("updated 2", prevalence.root.state, "state does not match");
            assertEquals(prevalence.root.started, started, "Started does not equals after re-open and loading journal");


            prevalence.takeSnapshot(function tookSnapshot() {
              console.log("Prevalence snapshot written.");
              prevalence.end();

              console.log("Prevalence closed. Re-opening 3...");
              prevalence = require('./Prevalence.js').factory(directory, initialState);
              prevalence.open(function opened() {
                console.log("Prevalence re-opened. 3");
                assertEquals("updated 2", prevalence.root.state, "state does not match");
                assertEquals(prevalence.root.started, started, "Started does not equals after re-open and loading snapshot");

                prevalence.execute({
                  execute: function assertCreateSecondJournal(root, executionTime) {
                    root.state = "second journal created";
                  }
                }, function (results) {
                  assertEquals("second journal created", prevalence.root.state, "state does not match");
                  assertEquals("initial root", initialState.state);

                  prevalence.end();

                  console.log("Prevalence closed. Re-opening 4...");
                  prevalence = require('./Prevalence.js').factory(directory, initialState);
                  prevalence.open(function opened() {
                    console.log("Prevalence re-opened 4.");
                    assertEquals("second journal created", prevalence.root.state, "state does not match");
                    assertEquals(prevalence.root.started, started, "Started does not equals after re-open and loading snapshot and loading a second journal");

                    prevalence.end();
                    console.log("Test over!");

                  });
                });
              });
            });
          });
        });
      });
    });
  }
);

function assertTrue(a, message) {
  if (!a) {
    throw "Expected true but was " + a + ". " + message;
  }
}
function assertEquals(a, b, message) {
  if (a !== b) {
    throw "Expected " + a + " but was " + b + ". " + message;
  }
}







