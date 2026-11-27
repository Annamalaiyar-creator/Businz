// App-wide drag & drop for every attachment field.
// Dropping files onto an upload button/box fills its <input type="file"> and fires the same
// "change" event as Browse, so each screen's existing validation and upload logic runs unchanged.

const ACTIVE_CLASS = 'bz-file-drop-active';

const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

// Upload zone = the <label> wrapping a file input, or the nearest small container holding exactly one.
const findDropInput = (target) => {
  if (!(target instanceof Element)) return null;
  const label = target.closest('label');
  const inLabel = label?.querySelector('input[type="file"]') || (label?.htmlFor && document.getElementById(label.htmlFor));
  if (inLabel && inLabel.type === 'file') return { zone: label, input: inLabel };
  let el = target;
  for (let depth = 0; el && depth < 4; depth += 1, el = el.parentElement) {
    const inputs = el.querySelectorAll('input[type="file"]');
    if (inputs.length === 1) return { zone: el, input: inputs[0] };
    if (inputs.length > 1) return null;
  }
  return null;
};

let activeZone = null;
const setActive = (zone) => {
  if (activeZone === zone) return;
  activeZone?.classList.remove(ACTIVE_CLASS);
  activeZone = zone;
  activeZone?.classList.add(ACTIVE_CLASS);
};

export function installGlobalFileDrop() {
  if (typeof window === 'undefined' || window.__bzFileDropInstalled) return;
  window.__bzFileDropInstalled = true;

  const style = document.createElement('style');
  style.textContent = `.${ACTIVE_CLASS}{outline:2px dashed #0E7490 !important;outline-offset:2px;background-color:rgba(14,116,144,0.08) !important;}`;
  document.head.appendChild(style);

  document.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); // also stops the browser from opening a file dropped outside a zone
    const found = findDropInput(e.target);
    const usable = found && !found.input.disabled;
    e.dataTransfer.dropEffect = usable ? 'copy' : 'none';
    setActive(usable ? found.zone : null);
  });

  document.addEventListener('dragleave', (e) => {
    if (activeZone && !activeZone.contains(e.relatedTarget)) setActive(null);
  });

  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setActive(null);
    const found = findDropInput(e.target);
    if (!found || found.input.disabled) return;
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length === 0) return;
    const dt = new DataTransfer();
    (found.input.multiple ? dropped : dropped.slice(0, 1)).forEach(f => dt.items.add(f));
    found.input.files = dt.files;
    found.input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
