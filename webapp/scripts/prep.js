const fs = require("fs");
const path = require("path");

fs.mkdirSync("data", { recursive: true });
if (fs.existsSync("../data/monitor.db")) fs.copyFileSync("../data/monitor.db", "data/monitor.db");

const Database = require("better-sqlite3");
const db = new Database(path.join("data", "monitor.db"), { readonly: true });
const cnpjs = db.prepare("SELECT cnpj FROM instituicoes").all().map((r) => r.cnpj);
db.close();
fs.writeFileSync(path.join("lib", "cnpjs.json"), JSON.stringify(cnpjs));
console.log(`prep: ${cnpjs.length} cnpjs exportados`);
