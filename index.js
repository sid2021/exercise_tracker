let express = require("express");
let app = express();

let dotenv = require("dotenv");
dotenv.config();

let bodyParser = require("body-parser");
let mongoose = require("mongoose");

mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

let listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

// create schemas
let exercisesSectionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: String,
});

let userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exercisesSectionSchema],
});

// create models based on schemas
let Session = mongoose.model("Session", exercisesSectionSchema);

let User = mongoose.model("User", userSchema);

app.post(
  "/api/exercise/new-user",
  bodyParser.urlencoded({ extended: false }),
  (req, res) => {
    let inputUsername = req.body.username;

    User.findOne({ username: inputUsername }, function (err, result) {
      if (err) {
        console.log(err);
      }

      if (!err && result != undefined) {
        res.send("Username already taken");
      } else if (!err) {
        let newUser = new User({
          username: inputUsername,
        });

        newUser.save(function (err, result) {
          if (err) {
            console.log(err);
          } else {
            res.json({
              username: inputUsername,
              _id: result._id,
            });
          }
        });
      }
    });
  }
);

app.get("/api/exercise/users", (req, res) => {
  User.find({}, (err, users) => res.send(users));
});

app.post(
  "/api/exercise/add",
  bodyParser.urlencoded({ extended: false }),
  (req, res) => {
    let inputDate;

    if (req.body.date != "") {
      inputDate = req.body.date;
    } else {
      inputDate = new Date().toISOString().substring(0, 10);
    }

    let newSession = new Session({
      description: req.body.description,
      duration: parseInt(req.body.duration),
      date: inputDate,
    });

    User.findByIdAndUpdate(
      req.body.userId,
      { $push: { log: newSession } },
      { new: true },
      (err, result) => {
        if (err) {
          console.log(err);
        } else {
          res.json({
            username: result.username,
            description: req.body.description,
            duration: parseInt(req.body.duration),
            _id: req.body.userId,
            date: new Date(inputDate).toDateString(),
          });
        }
      }
    );
  }
);

app.get("/api/exercise/log", (req, res) => {
  let userId = req.query.userId,
    inputFromDate = req.query.from,
    inputToDate = req.query.to,
    limit = req.query.limit;

  User.findById(userId, (err, user) => {
    if (!err) {
      let responseObject = {
        id: userId,
        username: user.username,
        count: user.log.length,
        log: user.log,
      };

      // apply "from" and "to" query filters
      if (inputFromDate || inputToDate) {
        // create "borders" for time comparison, from 1970 up to now
        let fromDate = new Date(0);
        let toDate = new Date();

        if (inputFromDate) {
          fromDate = new Date(inputFromDate);
        }

        if (inputToDate) {
          toDate = new Date(inputToDate);
        }

        // use unix timestamps for comparison
        fromDate = fromDate.getTime();
        toDate = toDate.getTime();

        // filter objects which are outside of defined borders
        let filteredResponseObject = responseObject.log.filter((d) => {
          let sessionDate = new Date(d.date).getTime();
          return sessionDate >= fromDate && sessionDate <= toDate;
        });

        responseObject.log = filteredResponseObject;
        responseObject.count = filteredResponseObject.length;
      }

      // apply "limit" query filter
      if (limit) {
        (responseObject.count = limit),
          (responseObject.log = user.log.slice(0, limit));
      }

      // respond with filtered or unfiltered object (depending whether
      // query parameters were used)
      res.json(responseObject);
    }
  });
});
