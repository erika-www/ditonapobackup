/** Open a print-ready trip record that can be saved as a PDF. */
export function generatePDFSummaryReport({ timeframe = 'Day', dutySession = {}, summary = {} }) {
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) return;

  const rawDate = summary.serviceDate || dutySession.serviceDate || new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(`${rawDate}T00:00:00`);
  const reportDate = Number.isNaN(parsedDate.getTime())
    ? rawDate
    : parsedDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const rows = Array.isArray(summary.stops) ? summary.stops : [];
  const totals = summary.totals || {};
  const dash = '-';
  const esc = (value) => String(value ?? dash).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const formatTime = (value) => {
    if (!value) return dash;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? dash
      : date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  };
  const driverName = summary.driverName || dutySession.driverName || 'Not assigned';
  const conductorName = summary.conductorName || dutySession.conductorName || 'Not assigned';
  const dispatcherName = summary.dispatcherName || dutySession.dispatcherName || 'Not assigned';
  const plateNumber = summary.plateNumber || dutySession.plateNumber || 'Not assigned';

  reportWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(timeframe)} Trip Summary - ${esc(rawDate)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 15mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    .sheet { width: 100%; }
    .details { display: grid; grid-template-columns: 1fr 1fr; column-gap: 70px; margin: 0 8px 28px; }
    .field { display: grid; grid-template-columns: 132px 1fr; align-items: end; min-height: 27px; }
    .label { white-space: nowrap; }
    .value { min-height: 20px; padding: 0 4px 2px; border-bottom: 1px solid #777; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #111; padding: 5px 7px; text-align: left; height: 27px; vertical-align: middle; }
    th { font-weight: 700; }
    th:nth-child(1) { width: 36%; }
    th:nth-child(2) { width: 14%; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { width: 16.66%; }
    td.number { text-align: center; }
    .total-row td { font-weight: 700; }
    .total-label { text-align: right; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin: 42px 12px 0; }
    .signature-name { min-height: 24px; border-bottom: 1px solid #777; text-align: center; padding-bottom: 3px; font-weight: 600; }
    .signature-label { padding-top: 5px; line-height: 1.15; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="details">
      <div>
        <div class="field"><span class="label">Driver's Name:</span><span class="value">${esc(driverName)}</span></div>
        <div class="field"><span class="label">Conductor's Name:</span><span class="value">${esc(conductorName)}</span></div>
        <div class="field"><span class="label">Dispatcher's Name:</span><span class="value">${esc(dispatcherName)}</span></div>
      </div>
      <div>
        <div class="field"><span class="label">Plate Number:</span><span class="value">${esc(plateNumber)}</span></div>
        <div class="field"><span class="label">Date:</span><span class="value">${esc(reportDate)}</span></div>
      </div>
    </section>

    <table aria-label="Passenger totals by stop">
      <thead><tr><th>Stop Name</th><th>Time</th><th>Boarded<br>Passengers</th><th>Alighted<br>Passengers</th><th>Total<br>Passengers</th></tr></thead>
      <tbody>
        ${rows.length ? rows.map((row) => `<tr><td>${esc(row.stopName)}</td><td>${esc(formatTime(row.lastEventAt))}</td><td class="number">${Number(row.boarded) || 0}</td><td class="number">${Number(row.alighted) || 0}</td><td class="number">${Number(row.total) || 0}</td></tr>`).join('') : '<tr><td colspan="5">No passenger events recorded for this period.</td></tr>'}
        <tr class="total-row"><td colspan="2" class="total-label">Total:</td><td class="number">${Number(totals.passengersBoarded) || 0}</td><td class="number">${Number(totals.passengersAlighted) || 0}</td><td class="number">${rows.length ? Number(rows[rows.length - 1]?.total) || 0 : 0}</td></tr>
      </tbody>
    </table>

    <section class="signatures">
      <div><div class="signature-name">${esc(driverName)}</div><div class="signature-label">Driver's Name and<br>Signature</div></div>
      <div><div class="signature-name">${esc(conductorName)}</div><div class="signature-label">Conductor's Name and<br>Signature</div></div>
      <div><div class="signature-name">${esc(dispatcherName)}</div><div class="signature-label">Dispatcher's Name and<br>Signature</div></div>
    </section>
  </main>
  <script>window.onload = () => window.print();</script>
</body>
</html>`);
  reportWindow.document.close();
}

/** Automatically download a CSV of the trip summary directly to disk */
export function downloadTripSummaryCSV({ timeframe = 'Day', dutySession = {}, summary = {} }) {
  if (typeof window === 'undefined' || !window.document) return;
  const rawDate = summary.serviceDate || dutySession.serviceDate || new Date().toISOString().slice(0, 10);
  const rows = Array.isArray(summary.stops) ? summary.stops : [];
  const totals = summary.totals || {};
  const driverName = summary.driverName || dutySession.driverName || 'Not assigned';
  const conductorName = summary.conductorName || dutySession.conductorName || 'Not assigned';
  const dispatcherName = summary.dispatcherName || dutySession.dispatcherName || 'Not assigned';
  const plateNumber = summary.plateNumber || dutySession.plateNumber || 'Not assigned';

  const formatTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '-'
      : date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  };

  let csv = `TRIP SUMMARY REPORT (${timeframe.toUpperCase()})\r\n`;
  csv += `Date,${rawDate}\r\n`;
  csv += `Driver,"${driverName}"\r\n`;
  csv += `Conductor,"${conductorName}"\r\n`;
  csv += `Dispatcher,"${dispatcherName}"\r\n`;
  csv += `Plate Number,"${plateNumber}"\r\n\r\n`;
  csv += `Stop Name,Time,Boarded Passengers,Alighted Passengers,Total Passengers\r\n`;

  rows.forEach((row) => {
    csv += `"${row.stopName || ''}","${formatTime(row.lastEventAt)}",${Number(row.boarded) || 0},${Number(row.alighted) || 0},${Number(row.total) || 0}\r\n`;
  });

  csv += `Total,-,${Number(totals.passengersBoarded) || 0},${Number(totals.passengersAlighted) || 0},${rows.length ? Number(rows[rows.length - 1]?.total) || 0 : 0}\r\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Trip_Summary_${plateNumber.replace(/\s+/g, '_')}_${rawDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
