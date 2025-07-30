import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import yaml from "js-yaml";
function isDotFile(name) {
    return name.startsWith('.');
}
function loadIgnoreList(ignoreFile) {
    if (!existsSync(ignoreFile))
        return new Set();
    const content = readFileSync(ignoreFile, "utf-8");
    return new Set(content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')));
}
function shouldIgnore(filePath, ignoreSet) {
    return ignoreSet.has(filePath) || ignoreSet.has(path.basename(filePath));
}
function getYamlFiles(dir, ignoreSet) {
    const entries = readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (isDotFile(entry.name))
            continue;
        if (shouldIgnore(fullPath, ignoreSet))
            continue;
        if (entry.isDirectory()) {
            files = files.concat(getYamlFiles(fullPath, ignoreSet));
        }
        else if (/\.yaml$/.test(entry.name)) {
            if (!shouldIgnore(fullPath, ignoreSet)) {
                files.push(fullPath);
            }
        }
    }
    return files;
}
function generateNextId(idSet) {
    const ids = Array.from(idSet).map(id => parseInt(id)).filter(n => !isNaN(n));
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    const newId = maxId + 1;
    idSet.add(String(newId));
    return newId;
}
function slugify(filename) {
    return filename
        .toLowerCase()
        .replace(/\.[^/.]+$/, "") // remove extension
        .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}
function getTopLevelFolder(filePath) {
    const parts = filePath.split(path.sep).filter(Boolean);
    return parts[0];
}
function run() {
    const rootDir = "./";
    const ignoreFile = ".ignore";
    const ignoreSet = loadIgnoreList(ignoreFile);
    const yamlFiles = getYamlFiles(rootDir, ignoreSet);
    const folderIdSets = new Map();
    yamlFiles.forEach((filePath) => {
        const content = readFileSync(filePath, "utf-8");
        const data = yaml.load(content);
        const folder = getTopLevelFolder(filePath);
        if (!folderIdSets.has(folder)) {
            folderIdSets.set(folder, new Set());
        }
        if (data?.id) {
            folderIdSets.get(folder).add(String(data.id));
        }
    });
    yamlFiles.forEach((filePath) => {
        const content = readFileSync(filePath, "utf-8");
        const data = yaml.load(content) || {};
        const folder = getTopLevelFolder(filePath);
        let updated = false;
        if (!data?.id) {
            const idSet = folderIdSets.get(folder);
            const newId = generateNextId(idSet);
            data.id = newId;
            updated = true;
            console.log(`✅ Added id: ${newId} → ${filePath}`);
        }
        if (!data?.slug) {
            const slug = slugify(path.basename(filePath));
            data.slug = slug;
            updated = true;
            console.log(`✅ Added slug: ${slug} → ${filePath}`);
        }
        if (updated) {
            const { id, slug, ...rest } = data;
            const orderedData = { id, slug, ...rest };
            const updatedYaml = yaml.dump(orderedData, { lineWidth: -1 });
            writeFileSync(filePath, updatedYaml, "utf-8");
        }
    });
}
run();
