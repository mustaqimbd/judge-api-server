const express = require("express");
const app = express();
const port = process.env.PORT || 5937;
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const generator = require("./generateFile");
const { executeCode } = require("./executeCode");

//Middleware
app.use(cors());
app.use(express.json());

const jwtVerify = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ error: true, message: "Unauthorized access!" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send("Access Denied");
  }
  jwt.verify(token, process.env.privetKey, function (err, decoded) {
    if (err || !decoded) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access!" });
    }
    req.decoded = decoded;
    next();
  });
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
});
app.use(limiter);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.znibnea.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollections = client.db("judge_api_db").collection("users");
    const codeSnippetsCollections = client
      .db("judge_api_db")
      .collection("code_snippets");
    const executionResultsCollections = client
      .db("judge_api_db")
      .collection("execution_results");

    app.get("/", (req, res) => {
      res.send("The server is running");
    });
    app.post("/user/login", async (req, res) => {
      const user = req.body;
      const result = await userCollections.insertOne(user);
      res.send(result);
    });
    app.post("/jwt-token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.privetKey, { expiresIn: "1h" });
      res.send({ token });
    });

    // API endpoint for code submission
    app.post("/code-submission", jwtVerify, async (req, res) => {
      try {
        const { code, language, user } = req.body;
        const decodedUser = req.decoded.email;
        if (!user || user !== decodedUser) {
          return res.status(403).send({ error: "Forbidden access" });
        }
        const result = await codeSnippetsCollections.insertOne({
          user,
          code,
          language,
          createdAt: new Date(),
        });
        res.status(201).send({ codeId: result.insertedId });
      } catch (err) {
        res.status(500).send({ error: "Failed to submit code" });
      }
    });
    // API endpoint for code execution
    app.post("/code-execution/:codeId", jwtVerify, async (req, res) => {
      try {
        const { user } = req.body;
        const decodedUser = req.decoded.email;
        if (!user || user !== decodedUser) {
          return res.status(403).send({ error: "Forbidden access" });
        }
        const codeId = req.params.codeId;
        const submittedCode = await codeSnippetsCollections.findOne({
          _id: new ObjectId(codeId),
        });
        let command;
        const { code, language } = submittedCode;
        const filepath = await generator(code, language);

        if (language === "javascript") {
          command = `node ${filepath}`;
        } 
        const output = await executeCode(command);
        const doc = {
          codeOutput: output,
          status: "Code executed successfully",
        };
        const result = await executionResultsCollections.insertOne(doc);
        res.status(201).send({ executeCodeId: result.insertedId });
      } catch (err) {
        const error = err.stderr || err.error;
        res.send({ error, status: "Failed to execute code error" });
      }
    });
    // API endpoint for result retrieval
    app.get(
      "/result-retrieve/:executedId/:user",
      jwtVerify,
      async (req, res) => {
        try {
          const user = req.params.user;
          const decodedUser = req.decoded.email;
          if (!user || user !== decodedUser) {
            return res.status(403).send({ error: "Forbidden access" });
          }
          const executeCodeId = req.params.executedId;
          const result = await executionResultsCollections.findOne({
            _id: new ObjectId(executeCodeId),
          });
          res.send(result);
        } catch (err) {
          res.status(500).send({ error: "Failed to retrieve result" });
        }
      }
    );

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`The server is running on port ${port}`);
});
