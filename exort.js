const imageUpload = document.getElementById('imageUpload');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const dominantColorDisplay = document.getElementById('dominantColor');
const detectedShapeDisplay = document.getElementById('detectedShape');
const uploadedImage = document.getElementById('uploadedImage');

imageUpload.addEventListener('change', function () {
    const file = imageUpload.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            
            const canvasAspect = canvas.width / canvas.height;
            const imageAspect = img.width / img.height;

            if (canvasAspect > imageAspect) {
                canvas.width = img.width * (canvas.height / img.height);
                canvas.height = canvas.height;
            } else {
                canvas.height = img.height * (canvas.width / img.width);
                canvas.width = canvas.width;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const dominantColor = getDominantColor(imageData);
            dominantColorDisplay.innerText = `${dominantColor}`;
            dominantColorDisplay.style.color = dominantColor;

            const detectedShape = detectShape(imageData);
            detectedShapeDisplay.innerText = detectedShape;

            uploadedImage.src = e.target.result;
            uploadedImage.style.display = 'none';
        };

        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

function getDominantColor(imageData) {
    const data = imageData.data;
    const colorCount = {};
    const ignoreThreshold = 10;
    let maxColor = "";
    let maxCount = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Ignore white and black pixels
        if ((r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) continue;

        const colorKey = `${r},${g},${b}`;
        colorCount[colorKey] = (colorCount[colorKey] || 0) + 1;

        if (colorCount[colorKey] > maxCount && colorCount[colorKey] > ignoreThreshold) {
            maxCount = colorCount[colorKey];
            maxColor = colorKey;
        }
    }

    if (!maxColor) return "UNKNOWN";  // Handle no color detected

    const [r, g, b] = maxColor.split(',').map(Number);
    return getColorName({ r, g, b });
}

function getColorName(rgb) {
    const { r, g, b } = rgb;

    if (r > 200 && g < 100 && b < 100) return "RED";
    if (r < 100 && g > 200 && b < 100) return "GREEN";
    if (r < 100 && g < 100 && b > 200) return "BLUE";
    if (r > 200 && g > 200 && b < 100) return "YELLOW";
    if (r > 200 && g < 100 && b > 200) return "MAGENTA";
    if (r < 100 && g > 200 && b > 200) return "CYAN";
    if (r > 150 && g > 150 && b > 150) return "WHITE";
    if (r < 100 && g < 100 && b < 100) return "BLACK";
    if (r > 150 && g < 150 && b > 150) return "VIOLET";
    if (r > 200 && g > 100 && b < 100) return "ORANGE";

    return "GRAY";
}

function detectShape(imageData) {
    const edgeDetection = detectEdges(imageData);
    const contours = findContours(edgeDetection);

    if (contours.length === 0) return 'NO SHAPE DETECTED';

    for (const contour of contours) {
        const simplifiedContour = simplifyContour(contour);
        const verticesCount = simplifiedContour.length;

        // Detect shapes based on vertices
        if (verticesCount === 3) {
            return 'TRIANGLE';
        } else if (verticesCount === 4) {
            const isSquare = isSquareShape(simplifiedContour);
            return isSquare ? 'SQUARE' : 'RECTANGLE';
        } else if (verticesCount === 5) {
            return 'PENTAGON';
        } else if (verticesCount === 6) {
            return 'HEXAGON';
        } else if (verticesCount >= 7 && verticesCount <= 9) {
            return 'OCTAGON';
        } else {
            return 'CIRCLE';  // Default for shapes with many points (approximate as a circle)
        }
    }

    return 'UNKNOWN SHAPE';  // Fallback if no shape matched
}

function simplifyContour(contour) {
    const simplified = [contour[0]];  // Start with the first point
    const tolerance = 5;  // Adjust this value to control simplification sensitivity

    for (let i = 1; i < contour.length; i++) {
        const [x1, y1] = simplified[simplified.length - 1];
        const [x2, y2] = contour[i];

        // Only add points that are sufficiently far apart
        if (Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) > tolerance) {
            simplified.push(contour[i]);
        }
    }

    return simplified;
}

function isSquareShape(contour) {
    const distances = [];
    for (let i = 0; i < contour.length; i++) {
        const [x1, y1] = contour[i];
        const [x2, y2] = contour[(i + 1) % contour.length];
        distances.push(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
    }
    const avgDist = distances.reduce((a, b) => a + b) / distances.length;
    return distances.every(dist => Math.abs(dist - avgDist) < avgDist * 0.3); // Adjusted tolerance
}

function detectEdges(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const grayscale = new Uint8ClampedArray(width * height);

    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        grayscale[i / 4] = avg;
    }

    return applySobel(grayscale, width, height);
}

function applySobel(grayscale, width, height) {
    const sobel = new Uint8ClampedArray(grayscale.length);

    for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {
            const index = (y * width) + x;

            const gx = (
                -1 * grayscale[index - width - 1] + 1 * grayscale[index - width + 1] +
                -2 * grayscale[index - 1] + 2 * grayscale[index + 1] +
                -1 * grayscale[index + width - 1] + 1 * grayscale[index + width + 1]
            );

            const gy = (
                -1 * grayscale[index - width - 1] + -2 * grayscale[index - width] + -1 * grayscale[index - width + 1] +
                1 * grayscale[index + width - 1] + 2 * grayscale[index + width] + 1 * grayscale[index + width + 1]
            );

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            sobel[index] = magnitude > 128 ? 255 : 0; // Threshold for edge detection
        }
    }

    return sobel;
}

function findContours(edgeData) {
    const width = canvas.width;
    const height = canvas.height;
    const visited = new Array(width * height).fill(false);
    const contours = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            if (edgeData[index] === 255 && !visited[index]) {
                const contour = traceContour(edgeData, visited, x, y, width, height);
                if (contour.length > 5) { // Only consider contours with more than 5 points
                    contours.push(contour);
                }
            }
        }
    }

    return contours;
}

function traceContour(edgeData, visited, startX, startY, width, height) {
    const contour = [];
    const queue = [[startX, startY]];
    visited[startY * width + startX] = true;

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        contour.push([x, y]);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx;
                const ny = y + dy;
                const index = ny * width + nx;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                    edgeData[index] === 255 && !visited[index]) {
                    visited[index] = true;
                    queue.push([nx, ny]);
                }
            }
        }
    }

    return contour;
}
