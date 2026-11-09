// Adds the photo category texts (PHOTO_TODO 4 + 9) to the 6 language files. Safe to run twice: a file that already
// has the keys is left alone. Run from the project folder (where PHOTO_TODO.md is): node apply-photo-categories-i18n.mjs
import fs from "node:fs";

const TEXTS = {
  en: {
    categoryLabel: "Category", categoryPlaceholder: "Choose a category", categoryRequired: "Please choose a category for your photo.",
    nature: "Nature & Landscapes", people: "People & Portraits", animals: "Animals & Pets", food: "Food & Drink", travel: "Travel & Places",
    buildings: "Buildings & Cities", vehicles: "Vehicles", art: "Art & Design", sports: "Sports & Events", other: "Other",
  },
  es: {
    categoryLabel: "Categoría", categoryPlaceholder: "Elige una categoría", categoryRequired: "Elige una categoría para tu foto.",
    nature: "Naturaleza y paisajes", people: "Personas y retratos", animals: "Animales y mascotas", food: "Comida y bebida", travel: "Viajes y lugares",
    buildings: "Edificios y ciudades", vehicles: "Vehículos", art: "Arte y diseño", sports: "Deportes y eventos", other: "Otros",
  },
  fr: {
    categoryLabel: "Catégorie", categoryPlaceholder: "Choisissez une catégorie", categoryRequired: "Veuillez choisir une catégorie pour votre photo.",
    nature: "Nature et paysages", people: "Personnes et portraits", animals: "Animaux de compagnie et animaux", food: "Cuisine et boissons", travel: "Voyages et lieux",
    buildings: "Bâtiments et villes", vehicles: "Véhicules", art: "Art et design", sports: "Sports et événements", other: "Autre",
  },
  hi: {
    categoryLabel: "श्रेणी", categoryPlaceholder: "एक श्रेणी चुनें", categoryRequired: "कृपया अपनी फ़ोटो के लिए एक श्रेणी चुनें।",
    nature: "प्रकृति और दृश्य", people: "लोग और पोर्ट्रेट", animals: "जानवर और पालतू", food: "खाना और पेय", travel: "यात्रा और जगहें",
    buildings: "इमारतें और शहर", vehicles: "वाहन", art: "कला और डिज़ाइन", sports: "खेल और आयोजन", other: "अन्य",
  },
  zh: {
    categoryLabel: "分类", categoryPlaceholder: "选择一个分类", categoryRequired: "请为你的照片选择一个分类。",
    nature: "自然与风景", people: "人物与肖像", animals: "动物与宠物", food: "美食与饮品", travel: "旅行与地点",
    buildings: "建筑与城市", vehicles: "交通工具", art: "艺术与设计", sports: "运动与活动", other: "其他",
  },
  ar: {
    categoryLabel: "الفئة", categoryPlaceholder: "اختر فئة", categoryRequired: "يرجى اختيار فئة لصورتك.",
    nature: "الطبيعة والمناظر", people: "الأشخاص والصور الشخصية", animals: "الحيوانات والحيوانات الأليفة", food: "الطعام والشراب", travel: "السفر والأماكن",
    buildings: "المباني والمدن", vehicles: "المركبات", art: "الفن والتصميم", sports: "الرياضة والفعاليات", other: "أخرى",
  },
};

const ANCHOR = /^  "photo\.upload\.another":.*\n/m;
let problems = 0;
for (const [lang, x] of Object.entries(TEXTS)) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(file)) { console.log(`MISSING  ${file}`); problems++; continue; }
  const src = fs.readFileSync(file, "utf8");
  if (src.includes('"photo.upload.categoryLabel"')) { console.log(`skip     ${file} (already has the texts)`); continue; }
  const match = src.match(ANCHOR);
  if (!match) { console.log(`NO ANCHOR  ${file}: line "photo.upload.another" not found, nothing changed`); problems++; continue; }
  const q = (s) => JSON.stringify(s);
  const lines = [
    `  "photo.upload.categoryLabel": ${q(x.categoryLabel)},`,
    `  "photo.upload.categoryPlaceholder": ${q(x.categoryPlaceholder)},`,
    `  "photo.upload.categoryRequired": ${q(x.categoryRequired)},`,
    `  // Photo categories (PHOTO_TODO 9); the keys are photoCategories in src/config/site.ts`,
    ...["nature", "people", "animals", "food", "travel", "buildings", "vehicles", "art", "sports", "other"].map(
      (key) => `  "photo.category.${key}": ${q(x[key])},`,
    ),
  ].join("\n") + "\n";
  const at = match.index + match[0].length;
  fs.writeFileSync(file, src.slice(0, at) + lines + src.slice(at));
  console.log(`updated  ${file}`);
}
process.exit(problems ? 1 : 0);
