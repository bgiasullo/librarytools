// Keep only subject_ids and annotations columns
function filterColumns(rows) {
  return rows.map(row => ({
    subject_ids: row.subject_ids,
    annotations: row.annotations
  }));
}

// Text blocks to remove
const removeBlocks = [
  `[{"task":"T4","value":"`,
  
  `","taskType":"textFromSubject"},{"task":"T1","task_type":"dropdown-simple","value":{"select_label":"Main Dropdown","option":true,"value":1,"label":"Page is blank"}}]`,

  `","taskType":"textFromSubject"},{"task":"T1","task_type":"dropdown-simple","value":{"select_label":"Main Dropdown","option":true,"value":0,"label":"Corrections made"}}]`,

  `","taskType":"textFromSubject"},{"task":"T1","task_type":"dropdown-simple","value":{"select_label":"Main Dropdown","option":true,"value":2,"label":"No corrections needed"}}]`,

  `","taskType":"textFromSubject"},{"task":"T1","task_type":"dropdown-simple","value":{"select_label":"Main Dropdown","option":true,"value":3,"label":"Text is illegible"}}]`
];

// Replace sequences
function applyReplacements(text) {
  if (!text) return text;
  return text
    .replace(/\\u0026/g, "&")
    .replace(/\\u003e/g, ">")
    .replace(/\\u003c/g, "<")
    .replace(/♂/g, "[male]")
    .replace(/♀/g, "[female]")
    .replace(/⚥/g, "[intersex]")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "[new line]");
}

// Remove blocks
function removeSpecifiedText(text) {
  if (!text) return text;
  let cleaned = text;
  for (const block of removeBlocks) {
    cleaned = cleaned.split(block).join("");
  }
  return cleaned;
}

// Text similarity helpers
function tokenize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
}

function termFreqMap(str) {
  const words = tokenize(str);
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }
  return freq;
}

function vecDot(a, b) {
  let sum = 0;
  for (const key in a) {
    if (b[key]) sum += a[key] * b[key];
  }
  return sum;
}

function cosineSimilarity(a, b) {
  const freqA = termFreqMap(a);
  const freqB = termFreqMap(b);

  const dot = vecDot(freqA, freqB);
  const magA = Math.sqrt(vecDot(freqA, freqA));
  const magB = Math.sqrt(vecDot(freqB, freqB));

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Main CSV processing
function processCSV() {
  const file = document.getElementById("csvfile").files[0];
  const status = document.getElementById("status");
  if (!file) {
    status.textContent = "Please upload a CSV file.";
    return;
  }

  status.textContent = "Reading CSV...";

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      let rows = results.data;

      // REMOVE all other columns first:
      rows = filterColumns(rows);

      status.textContent = "Cleaning text...";

      // Clean annotations
      rows = rows.map(row => {
        let txt = row.annotations;
        txt = removeSpecifiedText(txt);
        txt = applyReplacements(txt);
        return { ...row, annotations: txt };
      });

      // Group by subject_ids
      status.textContent = "Comparing annotations...";

      const groups = {};
      for (const row of rows) {
        if (!groups[row.subject_ids]) groups[row.subject_ids] = [];
        groups[row.subject_ids].push(row.annotations);
      }

      const finalRows = [];

      for (const subjectId in groups) {
        const annos = groups[subjectId];

        if (annos.length === 1) {
          finalRows.push({
            subject_ids: subjectId,
            annotations: annos[0]
          });
          continue;
        }

        let bestA = null, bestB = null;
        let bestSim = -1;

        for (let i = 0; i < annos.length; i++) {
          for (let j = i + 1; j < annos.length; j++) {
            const sim = cosineSimilarity(annos[i], annos[j]);
            if (sim > bestSim) {
              bestSim = sim;
              bestA = annos[i];
              bestB = annos[j];
            }
          }
        }

        const choice = Math.random() < 0.5 ? bestA : bestB;

        finalRows.push({
          subject_ids: subjectId,
          annotations: choice
        });
      }

      // Convert back to CSV
      status.textContent = "Preparing download...";

      const outCSV = Papa.unparse(finalRows);

      const blob = new Blob([outCSV], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cleaned-zooniverse-data.csv";
      a.click();
      URL.revokeObjectURL(url);

      status.textContent = "Done! Your cleaned CSV has downloaded.";
    }
  });
}
