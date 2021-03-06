var nodegit = require("../");
var path = require("path");
var promisify = require("promisify-node");
var fse = promisify(require("fs-extra"));
fse.ensureDir = promisify(fse.ensureDir);

var fileName = "newFile.txt";
var fileContent = "hello world";

var repoDir = "../../newRepo";

var repository;

var signature = nodegit.Signature.create("Foo bar",
  "foo@bar.com", 123456789, 60);

// Create a new repository in a clean directory, and add our first file
fse.remove(path.resolve(__dirname, repoDir))
.then(function() {
  return fse.ensureDir(path.resolve(__dirname, repoDir));
})
.then(function() {
  return nodegit.Repository.init(path.resolve(__dirname, repoDir), 0);
})
.then(function(repo) {
  repository = repo;
  return fse.writeFile(path.join(repository.workdir(), fileName), fileContent);
})

// Load up the repository index and make our initial commit to HEAD
.then(function() {
  return repository.openIndex();
})
.then(function(index) {
  index.read(1);
  index.addByPath(fileName);
  index.write();

  return index.writeTree();
})
.then(function(oid) {
  return repository.createCommit("HEAD", signature, signature,
    "initial commit", oid, []);
})

// Add a new remote
.then(function() {
  return nodegit.Remote.create(repository, "origin",
    "git@github.com:nodegit/push-example.git")
    .then(function(remote) {
      remote.connect(nodegit.Enums.DIRECTION.PUSH);

      var push;

      // We need to set the auth on the remote, not the push object
      remote.setCallbacks({
        credentials: function(url, userName) {
          return nodegit.Cred.sshKeyFromAgent(userName);
        }
      });

      // Create the push object for this remote
      return remote.push(
        ["refs/heads/master:refs/heads/master"],
        null,
        repository.defaultSignature(),
        "Push to master")
      .then(function(pushResult) {
        push = pushResult;

        // This just says what branch we're pushing onto what remote branch
        return push.addRefspec("refs/heads/master:refs/heads/master");
      }).then(function() {
        // This is the call that performs the actual push
        return push.finish();
      }).then(function() {
        // Check to see if the remote accepted our push request.
        return push.unpackOk();
      });
    });
}).done(function() {
  console.log("Done!");
});
