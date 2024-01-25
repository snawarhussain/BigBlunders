document.addEventListener('DOMContentLoaded', function () {

    var container = document.getElementById('grid');
    var width = container.clientWidth;
    var height = container.clientHeight;

    // Get references to the sliders
    var gxSlider = document.getElementById('gx-slider');
    var gySlider = document.getElementById('gy-slider');
    var gzSlider = document.getElementById('gz-slider');

    // Scene setup
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x011627);
    var camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    // camera.position.z = 50;
    camera.position.set(15, 20, 40);
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
    controls.maxPolarAngle = Math.PI;
    // set default  orientation at 45 angle

    // Create a 2D grid of arrows
    var gridSize = 8;
    var arrowSize = 2;
    var spacing = 3;
    var arrowHeadLength = arrowSize * 0.3; // For example, 30% of the arrow size
    var arrowHeadWidth = arrowSize * 0.3; // For example, 20% of the arrow size

    for (let i = -gridSize; i <= gridSize; i += spacing) {
        for (let j = -gridSize; j <= gridSize; j += spacing) {
            for (let k = -gridSize; k <= gridSize; k += spacing) {
                var dir = new THREE.Vector3(1, 0, 0);
                dir.normalize();
                var origin = new THREE.Vector3(i, j, k);
                var arrowHelper = new THREE.ArrowHelper(dir, origin, arrowSize, 0x45caff, arrowHeadLength, arrowHeadWidth);
                scene.add(arrowHelper);
            }
        }
    }

    // Function to update arrows' rotation

function updateArrowsSize() {
    var gxStrength = parseFloat(gxSlider.value); // Ensure these are numbers
    var gyStrength = parseFloat(gySlider.value);
    var gzStrength = parseFloat(gzSlider.value);


    var minScale = -1; // Assuming this is the minimum scale
var maxScale = 1; // Assuming this is the maximum scale (adjust as needed)

var color1 = new THREE.Color(0xff0000); // Red

var color2 = new THREE.Color(0x0000ff); // Blue


    scene.children.forEach(function (child) {
        if (child instanceof THREE.ArrowHelper) {
            var position = child.position;

            // Calculate scale factors based on position
            var scaleFactorX =  (gxStrength *.05 * position.x / gridSize);
            var scaleFactorY =  (gyStrength*.05 * position.y / gridSize);
            var scaleFactorZ =  (gzStrength*.05 * position.z / gridSize);


            // Update arrow size
            child.setLength(arrowSize + (scaleFactorX+scaleFactorY+scaleFactorZ), arrowHeadLength, arrowHeadWidth,);
             // Determine the color based on the scale factor
             var colorFactor = (100 - minScale) / (maxScale - minScale);
            //  var arrowColor = interpolateColor(color1, color2, colorFactor);
             var arrowColor = chroma.scale([
                0xff0000, 0xff8700, 0xffd300, 0xdeff0a, 0xa1ff0a, 0x0aff99, 0x0aefff, 0x147df5, 0x580aff, 0xbe0aff].reverse()).mode('lch')((scaleFactorX+scaleFactorY+scaleFactorZ)/6).hex();
            // var arrowColor = chroma.temperature((0, scaleFactorX+scaleFactorY+scaleFactorZ)).hex();  
             child.setColor(arrowColor);
        }
    });
}
// Create Axes Helper
var axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Event listeners for sliders
gxSlider.addEventListener('input', updateArrowsSize);
gySlider.addEventListener('input', updateArrowsSize);
gzSlider.addEventListener('input', updateArrowsSize);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
        renderer.render(scene, camera);
    }

    animate();

});
