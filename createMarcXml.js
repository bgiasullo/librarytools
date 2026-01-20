(function () {
  'use strict';

  /* ===============================
     DOM helpers (namespaced)
  ================================ */

  function marcById(id) {
    return document.getElementById(id);
  }

  /* ===============================
     MARC XML builder
  ================================ */

  function marcBuildXml(data) {
    const requiredFields = [
      'f001', 'lang008', 'startYear', 'endYear', 'f245', 'f650'
    ];

    for (let i = 0; i < requiredFields.length; i++) {
      const key = requiredFields[i];
      if (!data[key]) {
        throw new Error('Missing required field: ' + key);
      }
    }

    const field008 =
      '######s' +
      data.startYear +
      data.endYear +
      'xx######r#####000#0#' +
      data.lang008 +
      '#d';

    let xml =
`<?xml version="1.0" encoding="UTF-8"?>
<collection><record>
<leader>#####ntcaa22######u#4500</leader>
<controlfield tag="001">${data.f001}</controlfield>
<controlfield tag="008">${field008}</controlfield>
<datafield tag="040" ind1=" " ind2=" ">
  <subfield code="a">ANS</subfield>
</datafield>
`;

    if (data.f041) {
      xml +=
`<datafield tag="041" ind1="0" ind2=" ">
  <subfield code="a">${data.f041}</subfield>
</datafield>
`;
    }

    if (data.f100) {
      xml +=
`<datafield tag="100" ind1="1" ind2=" ">
  <subfield code="a">${data.f100}</subfield>
  <subfield code="e">author</subfield>
</datafield>
`;
    }

    xml +=
`<datafield tag="245" ind1="1" ind2="0">
  <subfield code="a">${data.f245}</subfield>
</datafield>
`;

    if (data.f520) {
      xml +=
`<datafield tag="520" ind1=" " ind2=" ">
  <subfield code="a">${data.f520}</subfield>
</datafield>
`;
    }

    if (data.f545) {
      xml +=
`<datafield tag="545" ind1=" " ind2=" ">
  <subfield code="a">${data.f545}</subfield>
</datafield>
`;
    }

    xml +=
`<datafield tag="650" ind1=" " ind2="0">
  <subfield code="a">${data.f650}</subfield>
</datafield>
`;

    if (data.f830) {
      xml +=
`<datafield tag="830" ind1=" " ind2="0">
  <subfield code="a">${data.f830}</subfield>
</datafield>
`;
    }

    xml += '</record></collection>';

    return xml;
  }

  /* ===============================
     Download helper
  ================================ */

  function marcDownloadXml(filename, xml) {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  /* ===============================
     Form wiring
  ================================ */

  document.addEventListener('DOMContentLoaded', function () {
    const form = marcById('marcForm');
    const status = marcById('marc_status');

    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';

      try {
        const xml = marcBuildXml({
          f001: marcById('marc_f001').value.trim(),
          lang008: marcById('marc_lang008').value.trim(),
          startYear: marcById('marc_startYear').value.trim(),
          endYear: marcById('marc_endYear').value.trim(),
          f041: marcById('marc_f041').value.trim(),
          f100: marcById('marc_f100').value.trim(),
          f245: marcById('marc_f245').value.trim(),
          f520: marcById('marc_f520').value.trim(),
          f545: marcById('marc_f545').value.trim(),
          f650: marcById('marc_f650').value.trim(),
          f830: marcById('marc_f830').value.trim()
        });

        marcDownloadXml(
          marcById('marc_f001').value + '.xml',
          xml
        );

        status.textContent = 'MARC XML generated.';
      } catch (err) {
        status.textContent = err.message;
      }
    });
  });

})();
