import * as THREE from "../node_modules/three/build/three.module.js";
import { OrbitControls } from "../node_modules/three/examples/jsm/controls/OrbitControls.js";
import { TextGeometry } from "../node_modules/three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "../node_modules/three/examples/jsm/loaders/FontLoader.js";
import {
  Raycaster,
  Vector2,
  Vector3,
} from "../node_modules/three/build/three.module.js";

// Create a button element
const detectButton = document.createElement("button");
detectButton.innerText = "Detect Feature";
detectButton.style.position = "absolute";
detectButton.style.top = "10px";
detectButton.style.left = "10px";
detectButton.style.padding = "10px";
detectButton.style.background = "#28a745";
detectButton.style.color = "white";
detectButton.style.border = "none";
detectButton.style.cursor = "pointer";
detectButton.style.fontSize = "16px";

// Append button to the document body
document.body.appendChild(detectButton);

// Add click event listener to trigger detection
detectButton.addEventListener("click", detectFeaturePoints);

// Setup Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 5;

// Add XYZ Axes Helper to the scene
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Y-Z plane grid
const gridYZ = new THREE.GridHelper(100, 100, 0x00ff00, 0xffffff);
gridYZ.rotation.y = Math.PI / 2;
gridYZ.position.set(0, 0, 0);
scene.add(gridYZ);

// Cube geometry for visualizing data
const cubeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cubes = [];

// Fetch data from the Socket.IO server
const socket = io("http://127.0.0.1:5000", {
  transports: ["websocket"], // Enforce WebSocket transport
});

socket.on("mediapipe_data", (data) => {
  // Add new cubes for new data points
  while (cubes.length < data.length) {
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cubes.push(cube);
    scene.add(cube);
  }

  // Update cube positions based on the incoming data
  data.forEach((point, i) => {
    const cube = cubes[i];
    if (cube) {
      cube.position.set(
        (point.x - 0.5) * 10,
        -(point.y - 0.5) * 10,
        -point.z * 5
      );
    }
  });

  // Remove extra cubes if there are fewer data points than cubes
  while (cubes.length > data.length) {
    const cube = cubes.pop();
    if (cube) scene.remove(cube);
  }
});

// Detect Feature Points
function detectFeaturePoints() {
  console.log("Feature detection triggered!");

  // Collect cube positions into a string
  let positionsText = "Cube Index, X, Y, Z\n"; // CSV-like header

  cubes.forEach((cube, index) => {
    const { x, y, z } = cube.position;
    positionsText += `${index}, ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(
      2
    )}\n`; // Add position to the text
  });

  // Create a Blob from the string (this is the file content)
  const blob = new Blob([positionsText], { type: "text/plain" });

  // Create an anchor element to download the file
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "feature_points.txt"; // File name
  link.click(); // Simulate click to download the file
}

// Listen for keyboard events
window.addEventListener("keydown", (event) => {
  if (event.key === "d" || event.key === "D") {
    detectFeaturePoints();
  }
});

// Animation loop to render the scene
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();

// OrbitControls for mouse-based interaction (rotation, zoom, pan)
const controls = new OrbitControls(camera, renderer.domElement);

// Raycasting setup for mouse interaction
const raycaster = new Raycaster();
const mouse = new Vector2();

// Add event listener for mouse movement
window.addEventListener("mousemove", onMouseMove, false);
window.addEventListener("mousedown", onMouseDown, false);

// Mouse move handler to update mouse position
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Mouse down handler to check which cube is clicked and allow dragging
let selectedCube = null;
let offset = null;

function onMouseDown(event) {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cubes);

  if (intersects.length > 0) {
    selectedCube = intersects[0].object;
    offset = new Vector3();
    offset.subVectors(selectedCube.position, intersects[0].point);
    window.addEventListener("mousemove", onMouseMoveDrag, false);
    window.addEventListener("mouseup", onMouseUp, false);
  }
}

// Mouse drag handler to move the selected cube
function onMouseMoveDrag(event) {
  if (!selectedCube || !offset) return;

  const mouse2D = new Vector2();
  mouse2D.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse2D.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse2D, camera);
  const intersects = raycaster.intersectObjects([scene]);
  if (intersects.length > 0) {
    const newPos = intersects[0].point;
    selectedCube.position.copy(newPos.add(offset));
  }
}

// Mouse up handler to stop dragging
function onMouseUp() {
  selectedCube = null;
  offset = null;
  window.removeEventListener("mousemove", onMouseMoveDrag, false);
  window.removeEventListener("mouseup", onMouseUp, false);
}

// Add labels for X, Y, Z axes
const fontLoader = new FontLoader();

fontLoader.load(
  "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
  (font) => {
    const createLabel = (text, position) => {
      const textGeometry = new TextGeometry(text, {
        font: font,
        size: 0.5,
        height: 0.1,
      });
      const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const label = new THREE.Mesh(textGeometry, textMaterial);
      label.position.copy(position);
      scene.add(label);
    };

    createLabel("X", new Vector3(5, 0, 0));
    createLabel("Y", new Vector3(0, 5, 0));
    createLabel("Z", new Vector3(0, 0, -5));
  }
);
