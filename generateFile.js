const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const codeFolderPath = path.join(__dirname, "codes");

if (!fs.existsSync(codeFolderPath)) {
  fs.mkdirSync(codeFolderPath, { recursive: true });
}

const generator = async (code, language) => {
  const createdId = uuid();
  const fileName = `${createdId + "-" + language}`;
  const filePath = path.join(codeFolderPath, fileName);
  await fs.promises.writeFile(filePath, code);
  return filePath;
};

module.exports = generator;
