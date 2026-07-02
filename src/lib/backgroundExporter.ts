/**
 * Utility to process and format large CSV content inside a Web Worker.
 * Prevents main-thread blocking / UI freeze during heavy document processing or report generation.
 */
export function exportToCSVInBackground(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  onNotifyStart?: () => void,
  onNotifySuccess?: () => void,
  onNotifyError?: (err: any) => void
) {
  if (onNotifyStart) onNotifyStart();

  const workerCode = `
    self.onmessage = function(e) {
      const { headers, rows } = e.data;
      try {
        // Build the CSV in chunks for extreme performance
        let csv = "\\uFEFF"; // UTF-8 BOM
        
        // Escape helper for CSV cells
        const escapeCell = (val) => {
          if (val === null || val === undefined) return '';
          let str = String(val);
          // If value has comma, double quotes, or new line, escape it properly
          if (str.includes(',') || str.includes('"') || str.includes('\\n') || str.includes('\\r')) {
            str = '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        };

        csv += headers.map(escapeCell).join(",") + "\\n";
        
        const totalRows = rows.length;
        // Batch processing to keep memory clean
        for (let i = 0; i < totalRows; i++) {
          csv += rows[i].map(escapeCell).join(",") + "\\n";
        }
        
        self.postMessage({ success: true, csv });
      } catch (error) {
        self.postMessage({ success: false, error: error.message || String(error) });
      }
    };
  `;

  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerURL = URL.createObjectURL(blob);
    const worker = new Worker(workerURL);

    worker.postMessage({ headers, rows });

    worker.onmessage = (e) => {
      const { success, csv, error } = e.data;
      worker.terminate();
      URL.revokeObjectURL(workerURL);

      if (success) {
        // Trigger safe client-side browser download
        const blobDownload = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const downloadUrl = URL.createObjectURL(blobDownload);
        
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        if (onNotifySuccess) onNotifySuccess();
      } else {
        console.error("Worker formatting failed:", error);
        if (onNotifyError) onNotifyError(error);
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      URL.revokeObjectURL(workerURL);
      console.error("Worker error:", err);
      if (onNotifyError) onNotifyError(err);
    };

  } catch (err) {
    // Graceful fallback to synchronous main thread processing in case of general environment limits
    console.warn("Could not launch Web Worker background exporter, falling back to main-thread processing:", err);
    try {
      const escapeCell = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      const csvContent = "\uFEFF" + headers.map(escapeCell).join(",") + "\n" + rows.map(r => r.map(escapeCell).join(",")).join("\n");
      const blobDownload = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blobDownload);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      if (onNotifySuccess) onNotifySuccess();
    } catch (fallbackErr) {
      if (onNotifyError) onNotifyError(fallbackErr);
    }
  }
}
