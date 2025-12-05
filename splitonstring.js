let $ = id => document.getElementById(id);

const fileInputString = $('fileInputString');
const statusString = $('statusString');
const zipWrapString = $('zipWrapString');
const splitStringInput = $('splitString');  // <-- NEW input for split text

let splitFilesString = [];

$('clearBtnString').onclick = resetUI;
$('processBtnString').onclick = handleString;

// ------------------ UI Helpers ------------------
function setStatusString(t) { statusString.textContent = t; }

function resetUI() {
  zipWrapString.hidden = true;
  splitFilesString = [];
  setStatusString('');
  fileInputString.value = '';
  splitStringInput.value = '';
}

// ------------------ Processing ------------------
function handleString() {
  const file = fileInputString.files[0];
  if (!file) return setStatusString('Choose a .txt file first.');

  const marker = splitStringInput.value.trim();
  if (!marker) return setStatusString('Enter a split marker string.');

  setStatusString('Reading...');

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = e.target.result;

      const parts = splitByMarker(text, marker);
      if (!parts.length) return setStatusString('No occurrences found for split marker.');

      splitFilesString = parts.map((p, i) => {
        const numSt = String(i + 1).padStart(4, '0');
        const baseNameSt = fileInputString.files[0].name.replace(/\.[^.]+$/, "");
        return {
          name: `${baseNameSt}_${numSt}.txt`,
          blob: new Blob([p], { type: 'text/plain' })
        };
      });

      zipWrapString.hidden = false;
      setStatusString(`Prepared ${parts.length} file(s).`);
    } catch (err) {
      console.error(err);
      setStatusString('Error: ' + err.message);
    }
  };

  reader.onerror = () => setStatusString('Error reading file.');
  reader.readAsText(file, 'utf-8');
}

// ------------------ Core splitting logic ------------------
function splitByMarker(text, marker) {
  // Split on the marker and discard empty first part if it exists
  let parts = text.split(marker);

  // Remove leading empty chunk if text began with the marker
  if (parts[0].trim() === '') parts.shift();

  // Re-add the marker to the *start* of each chunk so the user keeps it
  return parts.map(p => marker + p.trimStart());
}

// ------------------ ZIP Download ------------------
$('downloadZipString').onclick = async () => {
  if (!splitFilesString.length) return;
  setStatusString('Creating ZIP...');

  const zip = new JSZip();
  splitFilesString.forEach(f => zip.file(f.name, f.blob));

  const blob = await zip.generateAsync({ type: 'blob' });
  const baseNameSt = fileInputString.files[0].name.replace(/\.[^.]+$/, "");
  saveAs(blob, `${baseNameSt}.zip`);
  setStatusString(`ZIP downloaded.`);
};

// Show file name on selection
fileInputString.onchange = () => {
  if (fileInputString.files[0])
    setStatusString('Selected: ' + fileInputString.files[0].name);
};
