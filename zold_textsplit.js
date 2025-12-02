const $ = id => document.getElementById(id);
const fileInput = $('fileInput');
const outputList = $('outputList');
const status = $('status');
const zipWrap = $('zipWrap');
let splitFiles = [];

// ------------------ UI Helpers ------------------
function setStatus(t) { status.textContent = t; }
function resetUI() {
  outputList.innerHTML = '';
  outputList.hidden = true;
  zipWrap.hidden = true;
  splitFiles = [];
  setStatus('');
  fileInput.value = '';
}

$('clearBtn').onclick = resetUI;
$('processBtn').onclick = handleProcess;

// ------------------ Processing ------------------
function handleProcess() {
  const file = fileInput.files[0];
  if (!file) return setStatus('Choose a .txt file first.');
  setStatus('Reading...');

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = e.target.result;
      const parts = splitByImage(text);
      if (!parts.length) return setStatus('No Image <number> markers found.');

      buildList(parts);
      setStatus(`Created ${parts.length} file(s).`);
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + err.message);
    }
  };
  reader.onerror = () => setStatus('Error reading file.');
  reader.readAsText(file, 'utf-8');
}

// Core splitting logic
function splitByImage(text) {
  const regex = /Image\s+(\d+)\s*([\s\S]*?)(?=Image\s+\d+|$)/gi;
  const out = [];
  let m;

  while ((m = regex.exec(text))) {
    let content = m[2]
      .replace(/^\s*Transcription:\s*/i, '')   // drop leading "Transcription:"
      .replace(/^\n+|\n+$/g, '');              // trim leading/trailing newlines only

    out.push({
      name: `image_${m[1]}.txt`,
      text: content
    });
  }
  return out;
}

  // ------------------ ZIP Download ------------------
$('downloadZip').onclick = async () => {
  if (!splitFiles.length) return;
  setStatus('Creating ZIP...');

  const zip = new JSZip();
  splitFiles.forEach(f => zip.file(f.name, f.blob));

  const blob = await zip.generateAsync({type: 'blob'});
  saveAs(blob, 'image_splits.zip');
  setStatus(`ZIP downloaded.`);
};

// Show file name on selection
fileInput.onchange = () => {
  if (fileInput.files[0]) setStatus('Selected: ' + fileInput.files[0].name);
};
  
// Build download list
function buildList(parts) {
  outputList.innerHTML = '';
  outputList.hidden = false;
  zipWrap.hidden = false;

  splitFiles = parts.map(p =>
    ({ name: p.name, blob: new Blob([p.text], {type:'text/plain'}) })
  );

  parts.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    li.innerHTML = `
      <div>
        <strong>${p.name}</strong>
        <pre>${p.text.slice(0, 800)}${p.text.length > 800 ? '\n…(truncated)' : ''}</pre>
      </div>
    `;

    const btn = document.createElement('button');
    btn.textContent = 'Download';
    btn.onclick = () => saveAs(splitFiles[i].blob, splitFiles[i].name);

    li.appendChild(btn);
    outputList.appendChild(li);
  });
}
