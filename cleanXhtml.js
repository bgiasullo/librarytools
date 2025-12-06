// Read file
document.getElementById("processBtnXhtml").onclick = function () {
  const file = document.getElementById("fileInputXHTML").files[0];
  if (!file) return alert("Please upload an .xhtml file.");

  const reader = new FileReader();
  reader.onload = () => processFile(reader.result);
  reader.readAsText(file);
};

function processFile(text) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(text, "text/html");

  const divs = dom.querySelectorAll("div[id^='page-'][ia_leaf_number]");

  const rows = [];
  divs.forEach(div => {
    const h3 = div.querySelector("h3");
    const content = div.querySelector(".page-content");

    const h3Text = h3 ? h3.textContent.trim() : "";
    const contentText = content ? content.textContent.trim() : "";

    const finalText = (h3Text + "\n" + contentText).trim();

    rows.push([finalText]);
  });

  downloadCSV(rows);
}

function downloadCSV(rows) {
  let csv = "Text\n";
  rows.forEach(r => {
    // Escape quotes
    const safe = r[0].replace(/"/g, '""');
    csv += `"${safe}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const link = document.getElementById("downloadLink");
  link.href = url;
  link.download = "Text.csv";
  link.textContent = "Download CSV";
}
