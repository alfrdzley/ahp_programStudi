const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const path = require("path");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const { Parser } = require("json2csv");
const dotenv = require("dotenv");

const app = express();
const port = 3000;

const upload = multer({ dest: "uploads/" });

dotenv.config();
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

connection.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL");
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Set EJS as templating engine
app.set("view engine", "ejs");

// Calculate final score
function calculateScore(
  demand,
  cost,
  resources,
  academic_relevance,
  student_interest
) {
  const weights = [0.3, 0.2, 0.2, 0.15, 0.15];
  const values = [
    demand,
    cost,
    resources,
    academic_relevance,
    student_interest,
  ];
  return values.reduce((acc, val, i) => acc + val * weights[i], 0);
}

// Routes
app.get("/programs", (req, res) => {
  connection.query("SELECT * FROM program_studi", (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).send("Internal Server Error");
      return;
    }
    res.json(results);
  });
});

app.get("/programs/:id", (req, res) => {
  const { id } = req.params;
  connection.query(
    "SELECT * FROM program_studi WHERE id = ?",
    [id],
    (err, results) => {
      if (err) {
        console.error("Error fetching data:", err);
        res.status(500).send("Internal Server Error");
        return;
      }
      if (results.length === 0) {
        res.status(404).send("Program not found");
        return;
      }
      res.json(results[0]);
    }
  );
});

app.post("/programs", (req, res) => {
  const {
    nama,
    demand,
    cost,
    resources,
    academic_relevance,
    student_interest,
  } = req.body;
  const skor_akhir = calculateScore(
    parseFloat(demand),
    parseFloat(cost),
    parseFloat(resources),
    parseFloat(academic_relevance),
    parseFloat(student_interest)
  );

  // Check for duplicate before adding
  const checkQuery = "SELECT * FROM program_studi WHERE nama = ?";
  connection.query(checkQuery, [nama], (checkErr, checkResults) => {
    if (checkErr) {
      console.error("Error checking data:", checkErr);
      res.status(500).send("Internal Server Error");
      return;
    }
    if (checkResults.length === 0) {
      const insertQuery =
        "INSERT INTO program_studi (nama, demand, cost, resources, academic_relevance, student_interest, skor_akhir) VALUES (?, ?, ?, ?, ?, ?, ?)";
      connection.query(
        insertQuery,
        [
          nama,
          demand,
          cost,
          resources,
          academic_relevance,
          student_interest,
          skor_akhir,
        ],
        (insertErr) => {
          if (insertErr) {
            console.error("Error inserting data:", insertErr);
            res.status(500).send("Internal Server Error");
            return;
          }

          // Check for duplicates after insertion
          const deleteDuplicatesQuery = `
            DELETE t1 FROM program_studi t1
            INNER JOIN program_studi t2 
            WHERE 
              t1.id < t2.id AND 
              t1.nama = t2.nama;
          `;
          connection.query(
            deleteDuplicatesQuery,
            (deleteErr, deleteResults) => {
              if (deleteErr) {
                console.error("Error deleting duplicates:", deleteErr);
                res.status(500).send("Internal Server Error");
                return;
              }
              res.sendStatus(200);
            }
          );
        }
      );
    } else {
      res
        .status(400)
        .send(`Data with name "${nama}" already exists. Skipping...`);
    }
  });
});

app.put("/programs/:id", (req, res) => {
  const { id } = req.params;
  const {
    nama,
    demand,
    cost,
    resources,
    academic_relevance,
    student_interest,
  } = req.body;
  const skor_akhir = calculateScore(
    parseFloat(demand),
    parseFloat(cost),
    parseFloat(resources),
    parseFloat(academic_relevance),
    parseFloat(student_interest)
  );
  const query =
    "UPDATE program_studi SET nama = ?, demand = ?, cost = ?, resources = ?, academic_relevance = ?, student_interest = ?, skor_akhir = ? WHERE id = ?";
  connection.query(
    query,
    [
      nama,
      demand,
      cost,
      resources,
      academic_relevance,
      student_interest,
      skor_akhir,
      id,
    ],
    (err, results) => {
      if (err) {
        console.error("Error updating data:", err);
        res.status(500).send("Internal Server Error");
        return;
      }
      console.log(`Updated ${results.affectedRows} row(s)`);
      res.sendStatus(200);
    }
  );
});

app.delete("/programs/:id", (req, res) => {
  const { id } = req.params;
  console.log(`Deleting program with ID: ${id}`);
  const query = "DELETE FROM program_studi WHERE id = ?";
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error deleting data:", err);
      res.status(500).send("Internal Server Error");
      return;
    }
    console.log(`Deleted ${results.affectedRows} row(s)`);
    res.sendStatus(200);
  });
});

// Rute untuk menangani permintaan detail program dan mengirim file HTML
app.get("/programs/detail/:id", (req, res) => {
  const { id } = req.params;
  res.render("detail", { programId: id });
});

// Rute untuk menampilkan data tabel yang ditransposkan
app.get("/programs/transpose/:id", (req, res) => {
  const { id } = req.params;
  connection.query(
    "SELECT * FROM program_studi WHERE id = ?",
    [id],
    (err, results) => {
      if (err) {
        console.error("Error fetching data:", err);
        res.status(500).send("Internal Server Error");
        return;
      }
      if (results.length === 0) {
        res.status(404).send("Program not found");
        return;
      }
      const program = results[0];
      res.render("transpose", { program });
    }
  );
});

// Rute untuk ekspor data ke CSV
app.get("/export", (req, res) => {
  connection.query("SELECT * FROM program_studi", (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).send("Internal Server Error");
      return;
    }

    const fields = [
      "id",
      "nama",
      "demand",
      "cost",
      "resources",
      "academic_relevance",
      "student_interest",
      "skor_akhir",
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(results);

    res.header("Content-Type", "text/csv");
    res.attachment("programs.csv");
    res.send(csv);
  });
});

// Rute untuk mengunggah dan memproses CSV
app.post("/upload", upload.single("csvfile"), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      let errors = false;
      results.forEach((row, index) => {
        const {
          nama,
          demand,
          cost,
          resources,
          academic_relevance,
          student_interest,
        } = row;
        if (
          !nama ||
          isNaN(parseFloat(demand)) ||
          isNaN(parseFloat(cost)) ||
          isNaN(parseFloat(resources)) ||
          isNaN(parseFloat(academic_relevance)) ||
          isNaN(parseFloat(student_interest))
        ) {
          errors = true;
          console.error(`Error parsing row ${index + 1}: invalid data`);
          return;
        }
        const skor_akhir = calculateScore(
          parseFloat(demand),
          parseFloat(cost),
          parseFloat(resources),
          parseFloat(academic_relevance),
          parseFloat(student_interest)
        );
        const checkQuery = "SELECT * FROM program_studi WHERE nama = ?";
        connection.query(checkQuery, [nama], (checkErr, checkResults) => {
          if (checkErr) {
            console.error("Error checking data:", checkErr);
            errors = true;
            return;
          }
          if (checkResults.length === 0) {
            const query =
              "INSERT INTO program_studi (nama, demand, cost, resources, academic_relevance, student_interest, skor_akhir) VALUES (?, ?, ?, ?, ?, ?, ?)";
            connection.query(
              query,
              [
                nama,
                demand,
                cost,
                resources,
                academic_relevance,
                student_interest,
                skor_akhir,
              ],
              (insertErr) => {
                if (insertErr) {
                  console.error("Error inserting data:", insertErr);
                  errors = true;
                } else {
                  // Check for duplicates after insertion
                  const deleteDuplicatesQuery = `
                  DELETE t1 FROM program_studi t1
                  INNER JOIN program_studi t2 
                  WHERE 
                    t1.id < t2.id AND 
                    t1.nama = t2.nama;
                `;
                  connection.query(
                    deleteDuplicatesQuery,
                    (deleteErr, deleteResults) => {
                      if (deleteErr) {
                        console.error("Error deleting duplicates:", deleteErr);
                        errors = true;
                      }
                    }
                  );
                }
              }
            );
          } else {
            console.log(`Data with name "${nama}" already exists. Skipping...`);
          }
        });
      });
      fs.unlinkSync(req.file.path); // Delete the file after processing
      if (errors) {
        res
          .status(500)
          .send(
            "Errors occurred while processing the CSV file. Check server logs for details."
          );
      } else {
        res.sendStatus(200);
      }
    });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
