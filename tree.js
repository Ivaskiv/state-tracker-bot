import fs from 'fs';
import path from 'path';

function listDir(dir, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return '';
  const indent = ' '.repeat(depth * 2);
  let output = `${indent}${path.basename(dir)}\n`;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      output += listDir(fullPath, depth + 1, maxDepth);
    } else {
      output += `${' '.repeat((depth + 1) * 2)}${item}\n`;
    }
  }
  return output;
}

console.log(listDir('./src'));
