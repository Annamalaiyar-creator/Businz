import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANONICAL_PRODUCT_ALIASES } from '../src/utils/vrmProductsData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function deduplicateStoreFile(filename) {
  const filePath = path.join(projectRoot, 'server', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`[Deduplicate] File not found: ${filePath}`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let items = [];
  try {
    items = JSON.parse(raw);
  } catch (e) {
    console.error(`[Deduplicate] Failed to parse ${filename}:`, e.message);
    return;
  }

  if (!Array.isArray(items)) {
    console.log(`[Deduplicate] ${filename} is not an array`);
    return;
  }

  // Backup snapshot
  const backupDir = path.join(projectRoot, 'server', 'backups', 'pre_dedup_snapshot');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, `${filename.replace('.json', '')}_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, raw, 'utf8');
  console.log(`[Deduplicate] Backup saved to: ${backupFile}`);

  const itemMap = new Map();
  let mergedCount = 0;

  items.forEach(it => {
    if (!it || !it.code) return;
    const rawCode = String(it.code).toUpperCase().trim();
    const canonical = CANONICAL_PRODUCT_ALIASES[rawCode] || rawCode;

    if (!itemMap.has(canonical)) {
      itemMap.set(canonical, {
        ...it,
        code: canonical
      });
    } else {
      mergedCount++;
      const existing = itemMap.get(canonical);
      // Determine which entry is authoritative (has Zoho ID or matches canonical code)
      const isIncomingAuthoritative = (it.id || it.itemId || it.sku === canonical) && !(existing.id || existing.itemId);

      const mStock = Number(it.stock || 0);
      const eStock = Number(existing.stock || 0);
      const mPhys = Number(it.physicalStock || 0);
      const ePhys = Number(existing.physicalStock || 0);
      const mRes = Number(it.reserved || 0);
      const eRes = Number(existing.reserved || 0);

      const consolidatedPhys = Math.max(ePhys, mPhys);
      const consolidatedRes = Math.max(eRes, mRes);
      const consolidatedStock = Math.max(0, consolidatedPhys - consolidatedRes);

      if (isIncomingAuthoritative) {
        itemMap.set(canonical, {
          ...existing,
          ...it,
          code: canonical,
          physicalStock: consolidatedPhys,
          reserved: consolidatedRes,
          blockedForBom: consolidatedRes,
          stock: consolidatedStock,
          availableStock: consolidatedStock
        });
      } else {
        existing.physicalStock = consolidatedPhys;
        existing.reserved = consolidatedRes;
        existing.blockedForBom = consolidatedRes;
        existing.stock = consolidatedStock;
        existing.availableStock = consolidatedStock;
      }
    }
  });

  const deduplicated = Array.from(itemMap.values());
  fs.writeFileSync(filePath, JSON.stringify(deduplicated, null, 2), 'utf8');
  console.log(`[Deduplicate] ${filename}: reduced from ${items.length} to ${deduplicated.length} items (merged ${mergedCount} duplicates).`);
}

console.log('=== BUSINZ INVENTORY STORE DEDUPLICATION ===');
deduplicateStoreFile('item_store.json');
deduplicateStoreFile('raw_materials_store.json');
console.log('=== DEDUPLICATION COMPLETE ===');
