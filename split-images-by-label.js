#!/usr/bin/env node

const childProcess = require("child_process");
const tempy = require("tempy");
const { promises: fs } = require("fs");
const assert = require("assert");
const path = require("path");
const argv = require("minimist")(process.argv.slice(2));

const tap = (fn) => (x) => {
  fn(x);
  return x;
};

const intersect = (a, b) => new Set([...a].filter((i) => b.has(i)));

async function main() {
  // Parse arguments from argv
  const { _: labelsToKeep, input, keep, trash, trashWithLabels } = argv;
  assert(input);
  assert(keep);
  assert(trash);
  assert(labelsToKeep.length);

  const labelsToKeepSet = new Set([...labelsToKeep]);

  const files = await fs.readdir(input);

  const filesToKeep = [];
  const filesToTrash = [];

  console.log(`${files.length} files to process.`);

  for (const f of files) {
    console.log(`Processing: ${f}`);
    const file = path.join(input, f);

    const detectedLabels = await getLabels(file);
    const detectedLabelsSet = new Set(detectedLabels.map((l) => l.label));

    const intersection = intersect(labelsToKeepSet, detectedLabelsSet);

    if (intersection.size > 0) {
      console.log("-> keep: ", Array.from(intersection).join());
      fs.rename(file, path.join(keep, f));
      continue;
    }

    console.log("-> trash");
    if (trashWithLabels) {
      const filename = [...detectedLabelsSet, f].join("-").replace(/ /g, "-");
      fs.rename(file, path.join(trash, filename));
    } else {
      fs.rename(file, path.join(trash, f));
    }
  }
}

async function getLabels(inputFile, threshold = 0.05) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(path.join(__dirname, "darknet"), [
      "detect",
      "cfg/yolov3.cfg",
      "yolov3.weights",
      inputFile,
      "-thresh",
      threshold,
    ]);

    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stdout.on("end", () => {
      const pattern = new RegExp(/^(.+): (\d+)%$/);
      resolve(
        stdout
          .split("\n")
          .map((line) => pattern.exec(line))
          .filter(Boolean)
          .map(([, label, confidence]) => ({ label, confidence }))
      );
    });
  });
}

main();
