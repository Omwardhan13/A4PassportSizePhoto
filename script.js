const { jsPDF } = window.jspdf;
let cropper = null;
let croppedImageData = null;

document.getElementById('photoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const previewContainer = document.getElementById('previewContainer');
        previewContainer.innerHTML = `<img id="preview" src="${event.target.result}">`;

        const image = document.getElementById('preview');
        image.onload = () => {
            cropper = new Cropper(image, {
                aspectRatio: 35/45,
                viewMode: 1,
                autoCropArea: 1
            });
            document.getElementById('cropButton').classList.remove('hidden');
        };
    };
    reader.readAsDataURL(file);
});

document.getElementById('cropButton').addEventListener('click', function() {
    const canvas = cropper.getCroppedCanvas({
        width: 413,
        height: 531
    });

    const borderWidth = 2;
    const outputCanvas = document.getElementById('outputCanvas');
    outputCanvas.width = canvas.width + borderWidth * 2;
    outputCanvas.height = canvas.height + borderWidth * 2;

    const ctx = outputCanvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.drawImage(canvas, borderWidth, borderWidth);

    croppedImageData = outputCanvas.toDataURL('image/jpeg');
    document.getElementById('downloadButton').classList.remove('hidden');
});

document.getElementById('downloadButton').addEventListener('click', function() {
    if (!croppedImageData) return;

    const pdf = new jsPDF('landscape', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = 35 * 2.83465;
    const imgHeight = 45 * 2.83465;
    const padding = 5;

    const cols = Math.floor((pageWidth - padding) / (imgWidth + padding));
    const rows = Math.floor((pageHeight - padding - 50) / (imgHeight + padding));

    const totalWidth = cols * (imgWidth + padding) - padding;
    const xOffset = (pageWidth - totalWidth) / 2;

    for(let row = 0; row < rows; row++) {
        for(let col = 0; col < cols; col++) {
            const x = xOffset + col * (imgWidth + padding);
            const y = padding + row * (imgHeight + padding);
            pdf.addImage(croppedImageData, 'JPEG', x, y, imgWidth, imgHeight);
        }
    }

    const footerText = "PassportSize Photo to A4 Generator - Omwardhan Mishra";
    const textWidth = pdf.getTextWidth(footerText);
    const x = (pageWidth - textWidth) / 2;
    const y = pageHeight - 30;
    pdf.setTextColor(115, 194, 251);
    pdf.text(x, y, footerText);

    pdf.link(x, y - 10, textWidth, 12, { url: 'https://omwardhan13.github.io/A4PassportSizePhoto' });

    pdf.save('A4_PassoprtSizePhotos.pdf');
});