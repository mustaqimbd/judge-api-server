const { exec } = require("child_process");

const executeCode = (command) => {
  return new Promise((resolve, reject) => {
    exec(`${command}`, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
      } else if (stderr) {
        reject({ stderr });
      } else {
        resolve(stdout);
      }
    });
  });
};

module.exports = {
  executeCode,
};
