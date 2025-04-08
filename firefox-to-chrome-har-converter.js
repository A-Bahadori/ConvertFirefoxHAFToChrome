const fs = require('fs');
const path = require('path');

function fixTimings(entry) {
    if (!entry.timings || Object.keys(entry.timings).length === 0) {
      entry.timings = {
        blocked: -1,
        dns: -1,
        connect: -1,
        ssl: -1,
        send: 0,
        wait: 0,
        receive: 0
      };
      entry.time = 0;
    }
  //    else {
  //     const timings = entry.timings;
  //     entry.time = (timings.blocked >= 0 ? timings.blocked : 0) +
  //                  (timings.dns >= 0 ? timings.dns : 0) +
  //                  (timings.connect >= 0 ? timings.connect : 0) +
  //                  (timings.send >= 0 ? timings.send : 0) +
  //                  (timings.wait >= 0 ? timings.wait : 0) +
  //                  (timings.receive >= 0 ? timings.receive : 0);
  //   }
  }


function processHarFile(inputPath, outputPath) {
  const harData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  harData.log.entries.forEach(entry => {
    fixTimings(entry);
  });

  fs.writeFileSync(outputPath, JSON.stringify(harData, null, 2), 'utf8');
}

const inputPath = path.join(__dirname, 'Firefox-14040106-1.har');
const outputPath = path.join(__dirname, 'Firefox-14040106-1_modified.har');

processHarFile(inputPath, outputPath);
console.log('The corrected HAR file was successfully created.');