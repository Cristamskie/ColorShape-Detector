// Select HTML elements for image upload, canvas display, and combined result display
const imageUpload = document.getElementById('imageUpload');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const combinedResultDisplay = document.getElementById('combinedResult');
const placeholderText = document.querySelector('.placeholder-text');

// Event listener for image file upload
imageUpload.addEventListener('change', function () {
    const file = imageUpload.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Please upload a valid image file.');
        return;
    }

    // Read and display the uploaded image on the canvas
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            placeholderText.style.display = 'none'; // Hide placeholder text
            detectShapesAndColors(); // Call shape and color detection function
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

// Detect shapes and colors in the image
function detectShapesAndColors() {
    const src = cv.imread(canvas); // Read image from canvas
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY); // Convert to grayscale
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0); // Apply Gaussian blur
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150); // Detect edges with Canny edge detection

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE); // Find contours

    if (contours.size() === 0) {
        // No contours found, display no detection messages
        combinedResultDisplay.innerHTML = 'No color or shape detected';
        return;
    }

    // Clear previous detection result
    combinedResultDisplay.innerHTML = '';

    // Initialize an object to track both color and shape counts
    const shapeColorCount = {};

    // Iterate through each contour to classify shapes and colors
    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const approx = new cv.Mat();
        const epsilon = 0.02 * cv.arcLength(cnt, true);
        cv.approxPolyDP(cnt, approx, epsilon, true); // Approximate contour for shape

        let shape = ''; // Variable to store shape name
        const corners = approx.rows;

        // Classify shape based on number of corners
        if (corners === 3) {
            shape = 'TRIANGLE';
        } else if (corners === 4) {
            const rect = cv.boundingRect(cnt);
            const aspectRatio = rect.width / rect.height;
            shape = aspectRatio >= 0.95 && aspectRatio <= 1.05 ? 'SQUARE' : 'RECTANGLE';
        } else if (corners === 5) {
            shape = 'PENTAGON';
        } else if (corners > 6) {
            shape = isCircle(cnt) ? 'CIRCLE' : 'UNKNOWN';
        }

        // Create mask for color detection within the shape
        const mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        cv.drawContours(mask, contours, i, new cv.Scalar(255), -1); // Fill contour
        const dominantColor = getDominantColor(src, mask); // Get color name from color analysis
        mask.delete();

        // Create a unique key for each shape-color combination
        const shapeColorKey = `${shape} - ${dominantColor}`;
        shapeColorCount[shapeColorKey] = (shapeColorCount[shapeColorKey] || 0) + 1;
    }

    // Clear previous displays
    combinedResultDisplay.innerHTML = '';

    // Display each unique shape-color combination with its count
    for (const [shapeColor, count] of Object.entries(shapeColorCount)) {
        const [shape, color] = shapeColor.split(' - ');

        combinedResultDisplay.innerHTML += `
            <div style="text-align: center; display: flex; justify-content: center; color: ${getColorHex(color)};">
                ${shape} - ${color} (${count})
            </div>`;
    }

    // Display final result on the canvas
    cv.imshow(canvas, src);
    src.delete(); gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hierarchy.delete();
}

// Function to determine if a contour is a circle based on compactness
function isCircle(contour) {
    const perimeter = cv.arcLength(contour, true);
    const area = cv.contourArea(contour);
    const compactness = (perimeter * perimeter) / (4 * Math.PI * area);
    return compactness < 1.5; // Compactness threshold for circles
}

// Function to get dominant color within a masked area
function getDominantColor(src, mask) {
    const maskedSrc = new cv.Mat();
    src.copyTo(maskedSrc, mask);
    const mean = cv.mean(maskedSrc, mask); // Get average color in mask
    maskedSrc.delete();
    const rgb = { r: mean[0], g: mean[1], b: mean[2] };
    return getColorName(rgb); // Map to color name
}

// Map RGB values to color names with adjusted conditions for accuracy
function getColorName({ r, g, b }) {
    // Refined color thresholds to reduce "UNKNOWN" results
    if (r > 220 && g > 220 && b > 220) return "WHITE"; // White
    if (r > 200 && g < 100 && b < 100) return "RED"; // Red

    // Black conditions
    if (r < 30 && g < 30 && b < 30) return "BLACK"; // Default black
    if (r < 60 && g < 60 && b < 60) return "BLACK"; // Close to black

    // Green (with additional shades to improve detection)
    if (g > 200 && r < 100 && b < 100) return "GREEN"; // Bright Green
    if (g > 150 && r < 100 && b < 50) return "GREEN"; // Light Green
    if (g > 100 && r > 50 && b < 50 && r < 150) return "GREEN"; // Medium Green
    if (r < 80 && g > 180 && b < 80) return "GREEN"; // Dark Green
    if (g > 120 && r < 90 && b < 90) return "GREEN"; // Additional shade for darker greens
    if (g > 160 && r < 70 && b < 80) return "GREEN"; // Additional condition for darker green tones

    // Blue conditions
    if (b > 200 && g < 100 && r < 100) return "BLUE"; // Bright Blue
    if (b > 150 && g < 150 && r < 100) return "BLUE"; // Light Blue
    if (b > 100 && g > 150 && r < 100) return "BLUE"; // Sky Blue
    if (b > 120 && g > 150 && r < 200) return "BLUE"; // Light Blue

    // Yellow conditions
    if (r > 200 && g > 200 && b < 100) return "YELLOW"; // Yellow
    if (r > 180 && g > 180 && b < 150) return "YELLOW"; // Soft Yellow
    if (r > 150 && g > 150 && b < 100) return "YELLOW"; // Light Yellow
    if (r > 130 && g > 130 && b < 80) return "YELLOW"; // Medium Yellow
    if (r > 100 && g > 100 && b < 60) return "YELLOW"; // Dark Yellow
    if (r > 120 && g > 100 && b < 90) return "YELLOW"; // Olive-Yellow (slightly darker)
     // Other colors
    if (r > 180 && g < 80 && b > 180) return "MAGENTA"; // Magenta
    if (r < 80 && g > 180 && b > 180) return "CYAN"; // Cyan
    if (r > 160 && g > 160 && b > 160 && r < 220 && g < 220 && b < 220) return "GRAY"; // Gray

    // Orange conditions
    if (r > 200 && g > 100 && b < 70) return "ORANGE"; // Orange
    if (r > 255 && g > 200 && b < 100) return "ORANGE"; // Light Orange
    if (r > 255 && g > 165 && b < 100) return "ORANGE"; // Peach

    // Violet conditions
    if (r > 100 && g < 100 && b > 100) return "VIOLET"; // Violet
    if (r > 230 && g > 210 && b > 250) return "VIOLET"; // Light Violet

    return "UNKNOWN"; // Default for unclassified colors
}

// Function to return hex code for given color name
function getColorHex(colorName) {
    const colorHexMap = {
        "GREEN": "#3CB371",
        "RED": "#FF0000",
        "BLUE": "#0000FF",
        "YELLOW": "#FFFF00",
        "MAGENTA": "#FF00FF",
        "CYAN": "#00FFFF",
        "WHITE": "#FFFFFF",
        "BLACK": "#000000",
        "ORANGE": "#FFA500",
        "VIOLET": "#EE82EE",
        "GRAY": "#808080",
        "UNKNOWN": "#000000"
    };
    return colorHexMap[colorName] || "#000000";

}
