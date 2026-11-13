import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const id = process.argv[2];
if (!id || !/^[a-z0-9-]{1,64}$/.test(id)) throw new Error("用法：npm run build:extension -- sdk-example");
const sourceDir = path.join(rootDir, "extensions", id);
const manifestBytes = fs.readFileSync(path.join(sourceDir, "manifest.json"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
if (manifest.id !== id || manifest.entry !== "index.js") throw new Error("目录名必须与扩展 ID 相同，入口须为 index.js");
const outDir = path.join(rootDir, "dist-extensions", id);
await build({
  entryPoints: [path.join(sourceDir, "index.ts")],
  outfile: path.join(outDir, "index.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  charset: "utf8",
  loader: { ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
});

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value);
  return buf;
}

function u32(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = file.data;
    const checksum = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return Buffer.concat([...localParts, central, end]);
}

const archive = zipStore([
  { name: "manifest.json", data: manifestBytes },
  { name: "index.js", data: fs.readFileSync(path.join(outDir, "index.js")) },
]);
const output = path.join(rootDir, "dist-extensions", `${id}.cando-ext`);
fs.writeFileSync(output, archive);
console.log(`wrote ${output} (${archive.length} bytes)`);
