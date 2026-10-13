import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toKebabCase(str) {
  return String(str || '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_.]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

function toCamelCase(str) {
  return String(str || '')
    .replace(/[-_.\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

function parseOpeningTag(content, startIndex) {
  let i = startIndex;
  if (content[i] !== '<') return null;
  const tagMatch = content.slice(i).match(/^<(input|select|textarea)\b/i);
  if (!tagMatch) return null;
  const tag = tagMatch[1];
  i += tagMatch[0].length;

  let inDoubleQuote = false;
  let inSingleQuote = false;
  let inBacktick = false;
  let braceDepth = 0;

  while (i < content.length) {
    const char = content[i];
    const prev = i > 0 ? content[i - 1] : '';

    if (inDoubleQuote) {
      if (char === '"' && prev !== '\\') inDoubleQuote = false;
    } else if (inSingleQuote) {
      if (char === "'" && prev !== '\\') inSingleQuote = false;
    } else if (inBacktick) {
      if (char === '`' && prev !== '\\') inBacktick = false;
    } else if (char === '{') {
      braceDepth++;
    } else if (char === '}') {
      braceDepth--;
    } else if (braceDepth === 0) {
      if (char === '"') {
        inDoubleQuote = true;
      } else if (char === "'") {
        inSingleQuote = true;
      } else if (char === '`') {
        inBacktick = true;
      } else if (char === '>') {
        const isSelfClosing = content[i - 1] === '/';
        const attrs = content.slice(startIndex + tagMatch[0].length, isSelfClosing ? i - 1 : i);
        return {
          tag,
          attrs,
          startIndex,
          endIndex: i + 1,
          isSelfClosing
        };
      }
    }
    i++;
  }
  return null;
}

export function processFileAccessibility(filePath, dryRun = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  const baseName = path.basename(filePath, path.extname(filePath));
  const prefix = toKebabCase(baseName).replace(/-view$|-modal$|-page$|-screen$/, '');

  let idCounter = 1;
  let modifiedControls = 0;
  let modifiedLabels = 0;

  let index = 0;
  let result = '';

  while (index < content.length) {
    // Find next <input, <select, or <textarea
    const nextInput = content.indexOf('<input', index);
    const nextSelect = content.indexOf('<select', index);
    const nextTextarea = content.indexOf('<textarea', index);

    const candidates = [nextInput, nextSelect, nextTextarea].filter(pos => pos !== -1);
    if (candidates.length === 0) {
      result += content.slice(index);
      break;
    }

    const nextPos = Math.min(...candidates);
    // Append content before tag
    const precedingChunk = content.slice(index, nextPos);

    const parsed = parseOpeningTag(content, nextPos);
    if (!parsed) {
      result += content.slice(index, nextPos + 1);
      index = nextPos + 1;
      continue;
    }

    const { tag, attrs, startIndex, endIndex, isSelfClosing } = parsed;

    // Check type='hidden'
    if (/\btype\s*=\s*['"]hidden['"]/i.test(attrs)) {
      result += precedingChunk + content.slice(startIndex, endIndex);
      index = endIndex;
      continue;
    }

    const hasId = attrs.match(/\bid\s*=\s*(?:['"]([^'"]+)['"]|{`?([^`"}]+)`?})/i);
    const hasName = attrs.match(/\bname\s*=\s*(?:['"]([^'"]+)['"]|{`?([^`"}]+)`?})/i);
    const hasAria = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);

    if (hasId && hasName && hasAria) {
      result += precedingChunk + content.slice(startIndex, endIndex);
      index = endIndex;
      continue;
    }

    // Look for preceding <label in the precedingChunk (up to 300 chars back)
    const labelLookback = precedingChunk.slice(-300);
    const labelMatch = labelLookback.match(/<label\b([^>]*)>([\s\S]*?)<\/label>\s*$/i) ||
                       labelLookback.match(/<label\b([^>]*)>([\s\S]*?)$/i);

    let associatedLabelText = '';
    let labelHasHtmlFor = false;
    let existingHtmlFor = '';
    let updatedPrecedingChunk = precedingChunk;

    if (labelMatch) {
      const labelAttrs = labelMatch[1];
      const labelInner = labelMatch[2];
      labelHasHtmlFor = /\bhtmlFor\s*=/i.test(labelAttrs);
      const htmlForMatch = labelAttrs.match(/\bhtmlFor\s*=\s*['"]([^'"]+)['"]/i);
      if (htmlForMatch) existingHtmlFor = htmlForMatch[1];
      associatedLabelText = labelInner.replace(/<[^>]+>/g, '').replace(/[*:]/g, '').trim();
    }

    // Determine semantic hint
    let hint = '';
    if (associatedLabelText && associatedLabelText.length < 30) {
      hint = associatedLabelText;
    } else {
      const placeholderMatch = attrs.match(/\bplaceholder\s*=\s*(?:['"]([^'"]+)['"]|{([^}]+)})/i);
      const placeholder = placeholderMatch ? (placeholderMatch[1] || placeholderMatch[2]) : '';
      const valueMatch = attrs.match(/\bvalue\s*=\s*{([^}]+)}/i);
      const valueExpr = valueMatch ? valueMatch[1].trim() : '';
      const checkedMatch = attrs.match(/\bchecked\s*=\s*{([^}]+)}/i);

      if (placeholder && !placeholder.includes('$') && !placeholder.includes('{') && placeholder.length < 30) {
        hint = placeholder.replace(/e\.g\.|\.\.\.|Enter|Select|Type/gi, '').trim();
      } else if (valueExpr && !valueExpr.includes('?') && !valueExpr.includes('||') && !valueExpr.includes('&&') && !valueExpr.includes('.')) {
        hint = valueExpr;
      } else if (valueExpr && valueExpr.includes('.')) {
        const parts = valueExpr.split('.');
        hint = parts[parts.length - 1];
      } else if (checkedMatch) {
        const chk = checkedMatch[1];
        if (chk.includes('sameAsBilling')) hint = 'sameAsBilling';
        else if (chk.includes('all') || chk.includes('every')) hint = 'selectAll';
        else if (chk.includes('selectedRows') || chk.includes('includes')) hint = 'selectRow';
        else hint = 'checkbox';
      } else if (attrs.includes('rowsPerPage')) {
        hint = 'rowsPerPage';
      } else if (attrs.includes('totalPages') || attrs.includes('currentPage')) {
        hint = 'pageJump';
      } else {
        hint = `${tag}-${idCounter++}`;
      }
    }

    let cleanHint = hint.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/).slice(0, 3).join('-');
    if (!cleanHint) cleanHint = `${tag}-${idCounter++}`;

    const candidateId = existingHtmlFor || (hasId ? (hasId[1] || hasId[2]) : `${prefix}-${toKebabCase(cleanHint)}`);
    const candidateName = (hasName ? (hasName[1] || hasName[2]) : toCamelCase(cleanHint)) || 'formControl';
    
    // Clean candidateAria to never contain double quotes
    let candidateAria = (associatedLabelText || (attrs.match(/\bplaceholder\s*=\s*['"]([^'"]+)['"]/i)?.[1]?.replace(/e\.g\.|\.\.\./gi, '').trim()) || cleanHint.replace(/-/g, ' ')).replace(/["']/g, '').trim();

    const hasDynamicLoopItem = /\bitem\./i.test(attrs) || /\brow\./i.test(attrs) || /\bi\b/i.test(attrs) || /\bidx\b/i.test(attrs) || /\bsIdx\b/i.test(attrs);

    let idAttr = '';
    let nameAttr = '';
    let ariaAttr = '';

    if (!hasId) {
      if (hasDynamicLoopItem && attrs.includes('selectedRows')) {
        idAttr = ` id={\`${prefix}-row-select-\${row?.code || row?.id || idx}\`}`;
      } else if (hasDynamicLoopItem && (attrs.includes('item.') || attrs.includes('qty') || attrs.includes('rate'))) {
        idAttr = ` id={\`${prefix}-${toKebabCase(cleanHint)}-\${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}\`}`;
      } else if (hasDynamicLoopItem && attrs.includes('sIdx')) {
        idAttr = ` id={\`${prefix}-skel-\${sIdx}\`}`;
      } else {
        idAttr = ` id="${candidateId}"`;
      }
      modifiedControls++;
    }

    if (!hasName) {
      if (hasDynamicLoopItem && attrs.includes('selectedRows')) {
        nameAttr = ` name={\`selectRow_\${row?.code || row?.id || idx}\`}`;
      } else if (hasDynamicLoopItem) {
        nameAttr = ` name={\`${candidateName}_\${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}\`}`;
      } else {
        nameAttr = ` name="${candidateName}"`;
      }
      modifiedControls++;
    }

    if (!hasAria) {
      if (hasDynamicLoopItem && attrs.includes('selectedRows')) {
        ariaAttr = ` aria-label={\`Select row \${row?.code || row?.id || idx}\`}`;
      } else if (hasDynamicLoopItem && attrs.includes('sIdx')) {
        ariaAttr = ` aria-label="Loading row"`;
      } else if (candidateAria) {
        ariaAttr = ` aria-label="${candidateAria.charAt(0).toUpperCase() + candidateAria.slice(1)}"`;
      }
      modifiedControls++;
    }

    // Pair with label if label exists and doesn't have htmlFor
    if (labelMatch && !labelHasHtmlFor && candidateId && !candidateId.includes('${')) {
      const labelStartInPreceding = precedingChunk.lastIndexOf(labelMatch[0]);
      if (labelStartInPreceding !== -1) {
        const fullMatchedLabelTag = labelMatch[0];
        const updatedLabelTag = fullMatchedLabelTag.replace(/<label\b/i, `<label htmlFor="${candidateId}"`);
        updatedPrecedingChunk = precedingChunk.slice(0, labelStartInPreceding) + updatedLabelTag;
        modifiedLabels++;
      }
    }

    const selfCloseStr = isSelfClosing ? ' />' : '>';
    result += updatedPrecedingChunk + `<${tag}${idAttr}${nameAttr}${ariaAttr}${attrs}${selfCloseStr}`;
    index = endIndex;
  }

  if ((modifiedControls > 0 || modifiedLabels > 0) && !dryRun) {
    fs.writeFileSync(filePath, result, 'utf8');
  }

  return { file: filePath, modifiedControls, modifiedLabels };
}

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.endsWith('.jsx')) {
      results.push(full);
    }
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (target && target !== 'all') {
    console.log(`Processing accessibility for: ${target}`);
    const res = processFileAccessibility(target, false);
    console.log(`Updated ${res.modifiedControls} controls and ${res.modifiedLabels} labels in ${target}`);
  } else {
    console.log('🚀 Running Full Form Accessibility Audit & Fix across all BUSINZ components...');
    const allFiles = getFiles(path.resolve(__dirname, '../src/components'));
    let totalUpdatedFiles = 0;
    let totalControls = 0;
    let totalLabels = 0;

    allFiles.forEach(f => {
      const res = processFileAccessibility(f, false);
      if (res.modifiedControls > 0 || res.modifiedLabels > 0) {
        totalUpdatedFiles++;
        totalControls += res.modifiedControls;
        totalLabels += res.modifiedLabels;
        console.log(`✅ ${path.relative(process.cwd(), f)}: ${res.modifiedControls} controls, ${res.modifiedLabels} labels updated.`);
      }
    });

    console.log('\n=======================================================');
    console.log(`🎉 Accessibility Fix Complete!`);
    console.log(`Total files updated: ${totalUpdatedFiles}`);
    console.log(`Total controls enhanced with id/name/aria-label: ${totalControls}`);
    console.log(`Total labels linked with htmlFor: ${totalLabels}`);
    console.log('=======================================================\n');
  }
}
