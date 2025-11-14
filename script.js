const { jsPDF } = window.jspdf;
let cropper = null;
let filesList = [];
let currentIndex = 0;
let croppedImages = []; // array of dataURLs (saved crops)

const photoInput = document.getElementById('photoInput');
const previewContainer = document.getElementById('previewContainer');
const saveCropButton = document.getElementById('saveCropButton');
const saveNextButton = document.getElementById('saveNextButton');
const prevButton = document.getElementById('prevButton');
const downloadButton = document.getElementById('downloadButton');
const outputCanvas = document.getElementById('outputCanvas');
const thumbnails = document.getElementById('thumbnails');
const imageCounter = document.getElementById('imageCounter');

function resetPreviewArea() {
    previewContainer.innerHTML = `<div class="preview-placeholder"><span class="placeholder-text">Your photo preview will appear here</span></div>`;
}

function updateUIVisibility() {
    const hasFiles = filesList.length > 0;
    const hasSavedAny = croppedImages.length > 0;
    // Buttons visibility
    if (!hasFiles) {
        saveCropButton.classList.add('hidden');
        saveNextButton.classList.add('hidden');
        prevButton.classList.add('hidden');
        downloadButton.classList.add('hidden');
        imageCounter.textContent = '';
        thumbnails.innerHTML = '';
        resetPreviewArea();
        return;
    }
    // show crop/save controls
    saveCropButton.classList.remove('hidden');
    saveNextButton.classList.remove('hidden');
    prevButton.classList.remove('hidden');
    // download visible only when at least one saved crop exists
    if (hasSavedAny) downloadButton.classList.remove('hidden');
    else downloadButton.classList.add('hidden');

    // counter
    imageCounter.textContent = `Image ${currentIndex + 1} of ${filesList.length} — saved ${croppedImages.filter(Boolean).length} / ${filesList.length}`;
    renderThumbnails();
}

function renderThumbnails() {
    thumbnails.innerHTML = '';
    for (let i = 0; i < filesList.length; i++) {
        const img = document.createElement('img');
        img.dataset.index = i;
        if (croppedImages[i]) img.src = croppedImages[i];
        else {
            // small preview of original (not cropped) if available
            img.src = URL.createObjectURL(filesList[i]);
            // revoke objectURL after load to avoid leaks
            img.onload = () => URL.revokeObjectURL(img.src);
        }
        img.style.opacity = (i === currentIndex) ? '1' : '0.8';
        img.style.border = (croppedImages[i]) ? '2px solid var(--accent)' : '2px solid transparent';
        img.title = `Click to jump to image ${i+1}`;
        img.addEventListener('click', () => {
            loadFile(i, true);
        });
        thumbnails.appendChild(img);
    }
}

function loadFile(index, keepCropState=false) {
    // index = which file to show
    if (index < 0 || index >= filesList.length) return;
    currentIndex = index;
    // clear previous cropper
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    const file = filesList[index];
    const reader = new FileReader();
    reader.onload = function(event) {
        previewContainer.innerHTML = `<img id="preview" src="${event.target.result}">`;
        const image = document.getElementById('preview');
        image.onload = () => {
            cropper = new Cropper(image, {
                aspectRatio: 35/45,
                viewMode: 1,
                autoCropArea: 1
            });
            // if we have a saved crop for this index and keepCropState is false, show it?
            if (croppedImages[index] && !keepCropState) {
                // show the saved cropped result in the preview (so user can re-save or overwrite)
                // replace preview img with the saved cropped version for visual continuity
                const savedImg = document.createElement('img');
                savedImg.id = 'preview';
                savedImg.src = croppedImages[index];
                savedImg.onload = () => {
                    cropper.destroy();
                    cropper = new Cropper(savedImg, {
                        aspectRatio: 35/45,
                        viewMode: 1,
                        autoCropArea: 1
                    });
                    // replace DOM
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(savedImg);
                };
            }
            updateUIVisibility();
        };
    };
    reader.readAsDataURL(file);
}

photoInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) {
        filesList = [];
        croppedImages = [];
        updateUIVisibility();
        return;
    }
    filesList = files;
    croppedImages = new Array(filesList.length); // initially undefined entries
    currentIndex = 0;
    loadFile(0);
});

// Save crop for current image (without advancing)
saveCropButton.addEventListener('click', function() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
        width: 413,
        height: 531
    });

    const borderWidth = 2;
    outputCanvas.width = canvas.width + borderWidth * 2;
    outputCanvas.height = canvas.height + borderWidth * 2;

    const ctx = outputCanvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.drawImage(canvas, borderWidth, borderWidth);

    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.92);
    croppedImages[currentIndex] = dataUrl;
    updateUIVisibility();
});

// Save and go to next image
saveNextButton.addEventListener('click', function() {
    if (!cropper) return;
    // Save current
    const canvas = cropper.getCroppedCanvas({
        width: 413,
        height: 531
    });

    const borderWidth = 2;
    outputCanvas.width = canvas.width + borderWidth * 2;
    outputCanvas.height = canvas.height + borderWidth * 2;

    const ctx = outputCanvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.drawImage(canvas, borderWidth, borderWidth);

    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.92);
    croppedImages[currentIndex] = dataUrl;

    // move next
    if (currentIndex < filesList.length - 1) {
        loadFile(currentIndex + 1);
    } else {
        // if last, keep on last but allow download
        updateUIVisibility();
        // nice UX: indicate ready to download
        alert('All images processed (or save each). Click "Download PDF" to generate the A4 with distributed copies.');
    }
});

// Prev button to go backward to re-crop
prevButton.addEventListener('click', function() {
    if (currentIndex > 0) {
        loadFile(currentIndex - 1);
    }
});

// Download PDF: distribute 32 copies equally across croppedImages (if some are missing, use originals repeated)
downloadButton.addEventListener('click', function() {
    // Determine available images to use (prefer cropped if present, else original file data)
    const available = [];
    for (let i = 0; i < filesList.length; i++) {
        if (croppedImages[i]) {
            available.push(croppedImages[i]);
        } else {
            // fallback to original (small) dataURL
            available.push(URL.createObjectURL(filesList[i]));
        }
    }
    if (!available.length) {
        alert('No images available to generate PDF. Upload and save at least one crop.');
        return;
    }

    // If some URLs are blob URLs (object URLs), convert them to dataURLs synchronously not possible.
    // But jsPDF accepts blob URLs for addImage only if loaded into canvas. To keep logic simple,
    // we'll convert original file objects to dataURLs first if they are not already dataURLs in `available`.
    const convertPromises = available.map((src, idx) => {
        if (src.startsWith('data:')) return Promise.resolve(src);
        // blob URL or object URL — convert using FileReader on original file
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(filesList[idx]);
        });
    });

    Promise.all(convertPromises).then(dataUrls => {
        // Now we have dataUrls array for each image
        // Compute distribution of 32 total copies
        const totalCopies = 32;
        const n = dataUrls.length;
        const base = Math.floor(totalCopies / n);
        let remainder = totalCopies % n;
        const counts = new Array(n).fill(base);
        // distribute remainder, one extra to earliest images
        for (let i = 0; i < remainder; i++) counts[i]++;

        // Build array of images to place (in order)
        const imageQueue = [];
        for (let i = 0; i < n; i++) {
            for (let c = 0; c < counts[i]; c++) imageQueue.push(dataUrls[i]);
        }

        // Create PDF
        const pdf = new jsPDF('landscape', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Convert mm to points via 2.83465 px/mm (approx used earlier)
        const imgWidth = 35 * 2.83465;
        const imgHeight = 45 * 2.83465;
        const padding = 5;

        const cols = Math.floor((pageWidth - padding) / (imgWidth + padding));
        const rows = Math.floor((pageHeight - padding - 50) / (imgHeight + padding));

        const totalSlotsPerPage = cols * rows;
        // We currently only fill one page; you uploaded fewer than or equal totalSlotsPerPage or 32.
        // We'll place up to totalCopies (32) images (imageQueue length = 32).

        const totalWidth = cols * (imgWidth + padding) - padding;
        const xOffset = (pageWidth - totalWidth) / 2;

        let placed = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (placed >= imageQueue.length) break;
                const x = xOffset + col * (imgWidth + padding);
                const y = padding + row * (imgHeight + padding);
                pdf.addImage(imageQueue[placed], 'JPEG', x, y, imgWidth, imgHeight);
                placed++;
            }
            if (placed >= imageQueue.length) break;
        }

        // Footer
        const footerText = "PassportSize Photo to A4 Generator - Omwardhan Mishra";
        const textWidth = pdf.getTextWidth(footerText);
        const fx = (pageWidth - textWidth) / 2;
        const fy = pageHeight - 30;
        pdf.setTextColor(51, 156, 255);
        pdf.text(fx, fy, footerText);
        pdf.link(fx, fy - 10, textWidth, 12, { url: 'https://omwardhan13.github.io/A4PassportSizePhoto' });

        pdf.save('A4_PassportSizePhotos.pdf');

        // cleanup: revoke any object URLs used in thumbnails (if created)
        // (we used URL.createObjectURL only for thumbnails earlier and revoked on load)
    }).catch(err => {
        console.error(err);
        alert('Error generating PDF. See console for details.');
    });
});

// initialize UI
updateUIVisibility();
