const $ = id => document.getElementById(id);

const fileInputText = $('fileInputText');
const statusText = $('statusText');
const zipWrap = $('zipWrap');


let splitFiles = [];

$('clearBtnText').onclick = resetUI;
$('processBtnText').onclick = handleProcess;

// ------------------ UI Helpers ------------------
function setStatusText(t) { statusText.textContent = t; }

function resetUI() {
  zipWrap.hidden = true;
  splitFiles = [];
  setStatusText('');
  fileInputText.value = '';
}

// ------------------ Processing ------------------
function handleProcess() {
  const file = fileInputText.files[0];
  if (!file) return setStatusText('Choose a .txt file first.');
  setStatusText('Reading...');

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = e.target.result;
      const parts = splitByImage(text);
      if (!parts.length) return setStatusText('No Image <number> markers found.');

      splitFiles = parts.map(p =>
        ({ name: p.name, blob: new Blob([p.text], {type:'text/plain'}) })
      );

      zipWrap.hidden = false;
      setStatusText(`Prepared ${parts.length} file(s). Ready to ZIP.`);
    } catch (err) {
      console.error(err);
      setStatusText('Error: ' + err.message);
    }
  };

  reader.onerror = () => setStatusText('Error reading file.');
  reader.readAsText(file, 'utf-8');
}

// Core splitting logic
function splitByImage(text) {
  const regex = /Image\s+(\d+)\s*([\s\S]*?)(?=Image\s+\d+|$)/gi;
  const out = [];
  let m;

  while ((m = regex.exec(text))) {   
    const num = String(m[1]).padStart(4, '0');
    const baseName = fileInputText.files[0].name.replace(/\.[^.]+$/, ""); // remove extension

    let content = m[2]
      .replace(/^\s*Transcription:\s*/i, '')   // drop leading "Transcription:"
      .replace(/^\n+|\n+$/g, '');              // trim leading/trailing newlines

    out.push({
      name: `${baseName}_${num}.txt`, // ${fileInputText.files[0].name} image
      text: content
    });
  }
  return out;
}

// ------------------ ZIP Download ------------------
$('downloadZip').onclick = async () => {
  if (!splitFiles.length) return;
  setStatusText('Creating ZIP...');

  const zip = new JSZip();
  splitFiles.forEach(f => zip.file(f.name, f.blob));

  const blob = await zip.generateAsync({type: 'blob'});
  const baseName = fileInputText.files[0].name.replace(/\.[^.]+$/, ""); // remove extension
  saveAs(blob, `${baseName}.zip`); 
  setStatusText(`ZIP downloaded.`);
};

// Show file name on selection
fileInputText.onchange = () => {
  if (fileInputText.files[0]) setStatusText('Selected: ' + fileInputText.files[0].name);
};
