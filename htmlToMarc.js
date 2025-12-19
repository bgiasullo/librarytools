/**
 * convertHtmlToMarcXml(htmlOrFile, opts)
 *
 * Inputs:
 *  - htmlOrFile: either an HTML string OR a File/Blob object containing HTML
 *  - opts: optional object:
 *      - controlNumberPrefix: string to prefix control numbers (default '')
 *      - defaultLeader: string for MARC leader (default provided)
 *
 * Returns: Promise<string> that resolves to MARCXML string
 *
 * Behavior / heuristics:
 *  - Looks for: Dublin Core meta tags (dc.title, DC.title, dc.creator, dc.subject, dc.description, dc.date, dc.identifier, dc.format, dc.publisher)
 *  - schema.org JSON-LD (script[type="application/ld+json"]) fields: name, author, datePublished, description, about, sameAs, identifier
 *  - OpenGraph tags (og:title, og:description, og:url)
 *  - Simple EAD-ish tags: <unittitle>, <unitid>, <unitdate>, <origination>, <physdesc>, <abstract>, <scopecontent>
 *  - Falls back to common HTML: <title>, <h1>
 *
 * Output MARC fields produced:
 *  - <controlfield tag="001"> control number (unitid / identifier / generated)
 *  - 100 (creator/origination) if present
 *  - 245 title (with subtitle $b if title contains ":" or " - ")
 *  - 264/260 publication/date if present
 *  - 300 physical description / extent
 *  - 520 abstract/description
 *  - 650 subject repeated for each subject
 *  - 773 host/collection entry if isPartOf or relation present
 *  - 856 electronic location/link
 */

// Read file
document.getElementById("processBtnXhtmlForMARC").onclick = function () {
  const file = document.getElementById("fileInputXhtmlForMARC").files[0];
  if (!file) return alert("Please upload an .xhtml file.");

  const reader = new FileReader();
  reader.onload = () => convertHtmlToMarcXml(reader.result);
};

async function convertHtmlToMarcXml(htmlOrFile, opts = {}) {
  const { controlNumberPrefix = '', defaultLeader = '00000nam a2200000 a 4500' } = opts;

  // 1) Read input into string
  async function readInput(input) {
    if (typeof input === 'string') return input;
    if (input instanceof Blob || input instanceof File) {
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsText(input, 'utf-8');
      });
    }
    throw new Error('Input must be an HTML string or File/Blob.');
  }

  const html = await readInput(htmlOrFile);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 2) helpers to extract metadata
  function getMetaContent(...names) {
    // names can be meta name, meta property, itemprop (case-insensitive)
    for (const n of names) {
      // search meta[name="..."] and meta[property="..."] and meta[itemprop="..."]
      const byName = doc.querySelector(`meta[name="${n}"], meta[name="${n.toLowerCase()}"], meta[name="${n.toUpperCase()}"]`);
      if (byName && byName.content) return byName.content.trim();
      const byProp = doc.querySelector(`meta[property="${n}"], meta[property="${n.toLowerCase()}"], meta[property="${n.toUpperCase()}"]`);
      if (byProp && byProp.content) return byProp.content.trim();
      const byItem = doc.querySelector(`meta[itemprop="${n}"], meta[itemprop="${n.toLowerCase()}"], meta[itemprop="${n.toUpperCase()}"]`);
      if (byItem && byItem.content) return byItem.content.trim();
    }
    return null;
  }

  function getAllMetaContents(name) {
    const nodes = Array.from(doc.querySelectorAll(
      `meta[name="${name}"], meta[name="${name.toLowerCase()}"], meta[property="${name}"], meta[property="${name.toLowerCase()}"], meta[itemprop="${name}"], meta[itemprop="${name.toLowerCase()}"]`
    ));
    return nodes.map(n => (n.content || '').trim()).filter(Boolean);
  }

  // parse JSON-LD blocks and collect info
  function parseJsonLd() {
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    const results = [];
    for (const s of scripts) {
      try {
        const parsed = JSON.parse(s.textContent);
        if (Array.isArray(parsed)) results.push(...parsed);
        else results.push(parsed);
      } catch (e) {
        // ignore broken JSON-LD
      }
    }
    return results;
  }

  // extract EAD-ish elements (if HTML contains EAD-like markup)
  function getEadField(selector) {
    const el = doc.querySelector(selector);
    return el ? el.textContent.trim() : null;
  }

  // 3) gather metadata from multiple sources with priority order
  const jsonLd = parseJsonLd();

  // helper to get a property from JSON-LD objects
  function pickFromJsonLd(keys) {
    for (const obj of jsonLd) {
      for (const k of keys) {
        if (!obj) continue;
        if (obj[k]) return obj[k];
        // also check nested properties (e.g., author.name)
        if (typeof obj[k] === 'object' && obj[k].name) return obj[k].name;
      }
    }
    return null;
  }

  const metadata = {};

  // Title: dc.title, og:title, json-ld name, <title>, <h1>, EAD unittitle
  metadata.title =
    getMetaContent('DC.title', 'dc.title', 'title') ||
    getMetaContent('og:title') ||
    pickFromJsonLd(['name', 'headline', 'title']) ||
    getEadField('unittitle') ||
    (doc.querySelector('title') ? doc.querySelector('title').textContent.trim() : null) ||
    (doc.querySelector('h1') ? doc.querySelector('h1').textContent.trim() : null);

  // Creator / origination
  metadata.creator =
    getMetaContent('DC.creator', 'dc.creator', 'author') ||
    pickFromJsonLd(['author', 'creator', 'publisher']) ||
    getEadField('origination');

  // Date
  metadata.date =
    getMetaContent('DC.date', 'dc.date', 'date', 'dcterms.date') ||
    pickFromJsonLd(['datePublished', 'dateCreated']) ||
    getEadField('unitdate');

  // Identifier (could be URI or local unitid)
  metadata.identifier =
    getMetaContent('DC.identifier', 'dc.identifier', 'identifier') ||
    pickFromJsonLd(['identifier', 'sameAs']) ||
    getEadField('unitid') ||
    getMetaContent('og:url') ||
    (doc.querySelector('link[rel="canonical"]') ? doc.querySelector('link[rel="canonical"]').href : null);

  // Publisher / repository
  metadata.publisher =
    getMetaContent('DC.publisher', 'dc.publisher', 'publisher') ||
    pickFromJsonLd(['publisher']);

  // Format / extent
  metadata.format =
    getMetaContent('DC.format', 'dc.format', 'format') ||
    getEadField('physdesc');

  // Description / abstract / scopecontent
  metadata.description =
    getMetaContent('DC.description', 'dc.description', 'description') ||
    pickFromJsonLd(['description', 'abstract']) ||
    getEadField('abstract') ||
    getEadField('scopecontent') ||
    getMetaContent('og:description');

  // Subjects (can be multiple)
  metadata.subjects = [
    ...getAllMetaContents('DC.subject'),
    ...getAllMetaContents('dc.subject'),
    ...getAllMetaContents('subject')
  ].filter(Boolean);

  // If JSON-LD has about or keywords, use them
  const jsonKeywords = pickFromJsonLd(['keywords', 'about']);
  if (jsonKeywords) {
    if (Array.isArray(jsonKeywords)) metadata.subjects.push(...jsonKeywords);
    else if (typeof jsonKeywords === 'string') metadata.subjects.push(...jsonKeywords.split(',').map(s => s.trim()));
  }

  // Links / online location
  metadata.link =
    getMetaContent('DC.source', 'dc.source', 'og:url', 'url') ||
    pickFromJsonLd(['url', 'sameAs']) ||
    getMetaContent('og:url');

  // Relation / isPartOf (for collection-to-item linking)
  metadata.isPartOf = pickFromJsonLd(['isPartOf', 'partOf']) || getEadField('isPartOf');

  // Ensure uniqueness / clean subjects
  metadata.subjects = Array.from(new Set(metadata.subjects.map(s => s && s.replace(/\s*\.$/, '').trim()).filter(Boolean)));

  // 4) Build MARCXML document pieces
  function escapeXml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // generate a control number if none present
  const controlNumber = (metadata.identifier && String(metadata.identifier)) || `${controlNumberPrefix}${Date.now()}`;

  // Helper to create datafield tag strings
  function datafield(tag, ind1 = ' ', ind2 = ' ', subfields = []) {
    // subfields: array of {code:'a', value:'...'}
    const sub = subfields.map(sf => `<subfield code="${escapeXml(sf.code)}">${escapeXml(sf.value)}</subfield>`).join('');
    return `<datafield tag="${escapeXml(tag)}" ind1="${escapeXml(ind1)}" ind2="${escapeXml(ind2)}">${sub}</datafield>`;
  }

  // Helper to add field only if value present
  const fields = [];

  // Leader
  const leader = defaultLeader;
  // Controlfield 001
  fields.push(`<controlfield tag="001">${escapeXml(controlNumber)}</controlfield>`);

  // 003 repository / organization if publisher/repository known (optional)
  if (metadata.publisher) {
    fields.push(`<controlfield tag="003">${escapeXml(metadata.publisher)}</controlfield>`);
  }

  // 005 -- last transaction (we'll put current ISO date-time)
  const isoNow = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  fields.push(`<controlfield tag="005">${escapeXml(isoNow)}</controlfield>`);

  // 100 - main entry - personal name (creator)
  if (metadata.creator) {
    // Attempt to decide if personal vs corporate: naive heuristic (comma or space)
    // Use indicator 1 for surname entry if we detect comma (Last, First); otherwise 0.
    const ind1 = metadata.creator.includes(',') ? '1' : '0';
    fields.push(datafield('100', ind1, ' ', [{ code: 'a', value: metadata.creator }]));
  }

  // 245 - title statement
  if (metadata.title) {
    // try to split subtitle
    let titleMain = metadata.title;
    let titleRest = null;
    const splitOn = titleMain.includes(':') ? ':' : titleMain.includes(' - ') ? ' - ' : null;
    if (splitOn) {
      const idx = titleMain.indexOf(splitOn);
      titleRest = titleMain.slice(idx + splitOn.length).trim();
      titleMain = titleMain.slice(0, idx).trim();
    }
    const subfields = [{ code: 'a', value: titleMain }];
    if (titleRest) subfields.push({ code: 'b', value: titleRest });
    // ind1 - 1 if there is a personal/nonpersonal main entry present (we'll set 0)
    fields.push(datafield('245', '0', '0', subfields));
  }

  // 264/260 - publication/distribution (use 264 with indicator 1 by MARC21 for production)
  if (metadata.publisher || metadata.date) {
    const sub = [];
    if (metadata.publisher) sub.push({ code: 'b', value: metadata.publisher });
    if (metadata.date) sub.push({ code: 'c', value: metadata.date });
    fields.push(datafield('264', ' ', '1', sub));
  }

  // 300 - physical description / extent
  if (metadata.format) {
    fields.push(datafield('300', ' ', ' ', [{ code: 'a', value: metadata.format }]));
  }

  // 520 - summary, etc
  if (metadata.description) {
    fields.push(datafield('520', '3', ' ', [{ code: 'a', value: metadata.description }]));
  }

  // 650 - subject added entry (topical) - repeat for each subject
  for (const subj of metadata.subjects) {
    fields.push(datafield('650', ' ', '0', [{ code: 'a', value: subj }]));
  }

  // 773 - host item entry (link to collection)
  if (metadata.isPartOf) {
    const sub = [{ code: 't', value: metadata.isPartOf }];
    if (metadata.identifier) sub.push({ code: 'w', value: metadata.identifier });
    fields.push(datafield('773', '0', ' ', sub));
  }

  // 856 - electronic location and access
  if (metadata.link) {
    fields.push(datafield('856', '4', '0', [{ code: 'u', value: metadata.link }, ...(metadata.title ? [{ code: 'z', value: metadata.title }] : [])]));
  }

  // 035 - system control number (repeat)
  fields.push(`<datafield tag="035" ind1=" " ind2=" ">
    <subfield code="a">${escapeXml(controlNumber)}</subfield>
  </datafield>`);

  // assemble MARCXML
  const marcxml = `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
  <record>
    <leader>${escapeXml(leader)}</leader>
    ${fields.join('\n    ')}
  </record>
</collection>`;

  return marcxml;
}
