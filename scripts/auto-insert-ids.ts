import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import yaml from "js-yaml";

function isDotFile(name: string) {
  return name.startsWith('.');
}

function loadIgnoreList(ignoreFile: string): Set<string> {
  if (!existsSync(ignoreFile)) return new Set();
  const content = readFileSync(ignoreFile, "utf-8");
  return new Set(
    content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
  );
}

function shouldIgnore(filePath: string, ignoreSet: Set<string>): boolean {
  return ignoreSet.has(filePath) || ignoreSet.has(path.basename(filePath));
}

function getYamlFiles(dir: string, ignoreSet: Set<string>): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (isDotFile(entry.name)) continue;
    if (shouldIgnore(fullPath, ignoreSet)) continue;

    if (entry.isDirectory()) {
      files = files.concat(getYamlFiles(fullPath, ignoreSet));
    } else if (/\.yaml$/.test(entry.name)) {
      if (!shouldIgnore(fullPath, ignoreSet)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function generateNextId(idSet: Set<string>): number {
  const ids = Array.from(idSet).map(id => parseInt(id)).filter(n => !isNaN(n));
  const maxId = ids.length > 0 ? Math.max(...ids) : 0;
  const newId = maxId + 1;
  idSet.add(String(newId));
  return newId;
}
function getTopLevelFolder(filePath: string): string {
  const parts = filePath.split(path.sep).filter(Boolean);
  return parts[0];
}

function run() {
  const rootDir = "./";
  const ignoreFile = ".ignore";
  const ignoreSet = loadIgnoreList(ignoreFile);
  const yamlFiles = getYamlFiles(rootDir, ignoreSet);

  const folderIdSets = new Map<string, Set<string>>();


  yamlFiles.forEach((filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const data: any = yaml.load(content);
    const folder = getTopLevelFolder(filePath);

    if (!folderIdSets.has(folder)) {
      folderIdSets.set(folder, new Set());
    }

    if (data?.id) {
      folderIdSets.get(folder)!.add(String(data.id));
    }
  });

  yamlFiles.forEach((filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const data: any = yaml.load(content);
    const folder = getTopLevelFolder(filePath);

    if (!data?.id) {
      const idSet = folderIdSets.get(folder)!;
      const newId = generateNextId(idSet);
      const newData = { id: newId, ...data };
      const updatedYaml = yaml.dump(newData, { lineWidth: -1 });
      writeFileSync(filePath, updatedYaml, "utf-8");
      console.log(`✅ Added id: ${newId} → ${filePath}`);
    }
  });
}

run();

