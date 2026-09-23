#!/usr/bin/env node
/**
 * בונה קטלוג סטטי (gifs.json) מתוך תיקיית ה-gif של המאגר.
 * רץ בתוך GitHub Action על checkout מלא - לא נוגע ב-API של גיטהאב,
 * ולכן לא צורך מהמכסה של 60 בקשות לשעה.
 *
 * הפלט: gifs.json בשורש המאגר, במבנה שהתוסף מצפה לו:
 * {
 *   updated:    ISO timestamp של הבנייה
 *   categories: [{ value, label }]      // value = שם תיקייה (או "" לשורש)
 *   byCategory: { [value]: [{ name, url, path, tags }] }
 * }
 *
 * tags.json אופציונלי בשורש תיקיית ה-gif:
 * { "שם_הקובץ_בלי_gif": ["תגית1", "תגית2"] }
 */

const fs = require("fs");
const path = require("path");

// צריך להתאים ל-config.js של התוסף (owner/repo/branch)
const OWNER = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[0]
  : "TOP-SHEBAMITMACHIM";
const REPO_NAME = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[1]
  : "top-gif";
const BRANCH = process.env.GIT_BRANCH || "main";

// תיקיית הגיפים בתוך המאגר - כמו cfg.path בתוסף
const GIF_DIR = "gif";

const root = path.resolve(__dirname, "..");
const baseDir = path.join(root, GIF_DIR);
const OUT_FILE = path.join(root, "gifs.json");

const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO_NAME}/${BRANCH}/${GIF_DIR}`;

if (!fs.existsSync(baseDir)) {
  console.error(`תיקיית הגיפים לא נמצאה: ${GIF_DIR}`);
  process.exit(1);
}

// ---- tags.json אופציונלי ----
let tags = {};
const tagsPath = path.join(baseDir, "tags.json");
if (fs.existsSync(tagsPath)) {
  try {
    tags = JSON.parse(fs.readFileSync(tagsPath, "utf8"));
    console.log(`נטען tags.json עם ${Object.keys(tags).length} רשומות`);
  } catch (e) {
    console.warn("tags.json לא תקין - ממשיכים בלי תגיות:", e.message);
  }
}

// ---- סריקת השורש ----
const entries = fs.readdirSync(baseDir, { withFileTypes: true });
const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
const rootGifs = entries
  .filter((e) => e.isFile() && /\.gif$/i.test(e.name))
  .map((e) => e.name);

const toEntry = (name, categoryValue) => {
  const cleanName = name.replace(/\.gif$/i, "");
  const relPath = categoryValue ? `${categoryValue}/${name}` : name;
  // encodeURIComponent לכל חלק נתיב (raw מקבל אחוזים)
  const encoded = relPath.split("/").map((p) => encodeURIComponent(p)).join("/");
  return {
    name: cleanName,
    url: `${RAW_BASE}/${encoded}`,
    path: `${GIF_DIR}/${relPath}`,
    tags: tags[cleanName] || []
  };
};

const categories = [];
const byCategory = {};

if (rootGifs.length) {
  categories.push({ value: "", label: "כללי" });
  byCategory[""] = rootGifs.map((n) => toEntry(n, ""));
}

for (const dir of dirs.sort((a, b) => a.localeCompare(b, "he"))) {
  const dirPath = path.join(baseDir, dir);
  const files = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.gif$/i.test(e.name))
    .map((e) => e.name);
  categories.push({ value: dir, label: dir });
  byCategory[dir] = files.map((n) => toEntry(n, dir));
  console.log(`${dir}: ${files.length} גיפים`);
}

const catalog = {
  updated: new Date().toISOString(),
  categories,
  byCategory
};

fs.writeFileSync(OUT_FILE, JSON.stringify(catalog, null, 2), "utf8");

const total = Object.values(byCategory).reduce((s, arr) => s + arr.length, 0);
console.log(`gifs.json נוצר: ${categories.length} קטגוריות, ${total} גיפים סה"כ`);
