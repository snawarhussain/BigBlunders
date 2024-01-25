document.addEventListener('DOMContentLoaded', function() {

    var container = document.getElementById('cube');
    var width = container.clientWidth;
    var height = container.clientHeight;

    // Get references to the sliders
    var horizontalSlider = document.getElementById('horizontal-slider');
    var verticalSlider = document.getElementById('vertical-slider');

    // Scene setup
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x011627);
var camera = new THREE.PerspectiveCamera(85, width / height, 0.1, 1000);
camera.position.z = 50;
var renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

// orbit controls
// OrbitControls setup
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI / 2;

// Create a 2D grid of arrows
var gridSize = 32;
var arrowSize = 2;
var spacing = 3;
var arrowHeadLength = arrowSize * 0.3; // For example, 30% of the arrow size
var arrowHeadWidth = arrowSize * 0.3; // For example, 20% of the arrow size

for (let i = -gridSize; i <= gridSize; i += spacing) {
    for (let j = -gridSize; j <= gridSize; j += spacing) {
        var dir = new THREE.Vector3(1, 0, 0);
        dir.normalize();
        var origin = new THREE.Vector3(i, j, 0);
        var arrowHelper = new THREE.ArrowHelper(dir, origin, arrowSize, 0x45caff, arrowHeadLength, arrowHeadWidth);
        scene.add(arrowHelper);
    }
}

// Event listener for horizontal slider
horizontalSlider.addEventListener('input', function() {
    updateArrowsRotation();
});

// Event listener for vertical slider
verticalSlider.addEventListener('input', function() {
    updateArrowsRotation();
});

// Function to update arrows' rotation
function updateArrowsRotation() {
    var horizontalPhase = horizontalSlider.value; // Value from the horizontal slider
    var verticalPhase = verticalSlider.value; // Value from the vertical slider

    scene.children.forEach(function(child) {
        if (child instanceof THREE.ArrowHelper) {
            // Get the position of the arrow
            var position = child.position;

            // Calculate rotation based on position and phase
            // Assuming the phase effect diminishes towards the center of the grid
            var horizontalRotation = THREE.MathUtils.degToRad(horizontalPhase * position.x / gridSize);
            var verticalRotation = THREE.MathUtils.degToRad(verticalPhase * position.y / gridSize);

            // Apply the rotation
            // You can adjust this formula to get the desired effect
            child.rotation.z = horizontalRotation; // Rotate around Z-axis for horizontal slider
            child.rotation.z += verticalRotation; // Add rotation for vertical slider
        }
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
    renderer.render(scene, camera);
}

animate();

});
