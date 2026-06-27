/**
 * Utility to resize and compress user uploaded avatar photos client-side
 * before storing them in Firestore.
 */
export function resizeImageToMax(file: File, maxWidth: number = 128, maxHeight: number = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate best dimensions to maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Nie można utworzyć kontekstu graficznego."));
          return;
        }

        // Fill background white to handle transparent PNGs nicely
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with 0.75 quality for micro sizes
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error("Błędny format lub uszkodzony plik obrazu."));
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error("Nie udało się odczytać zawartości pliku."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Błąd podczas odczytu pliku z dysku."));
    };
    reader.readAsDataURL(file);
  });
}
