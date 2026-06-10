const page = {
  projectName: "IrisDepth MRI",
  headline: "Facial Tracking for MRI Motion Correction",
  subheadline: "Real-time face pose estimation with iris-based depth cues for scanner-side motion correction.",
  metrics: [
    { value: "10 ms", label: "avg latency", icon: "timer" },
    { value: "MediaPipe", label: "Google Face Landmarker", icon: "mesh" },
    { value: "iris scale", label: "depth cue", icon: "eye" }
  ],
  steps: [
    {
      title: "Camera frame",
      image: "./assets/step-camera-frame.png",
      alt: "Minimal camera-frame face illustration"
    },
    {
      title: "Face landmarks + iris detection",
      image: "./assets/step-face-landmarks-iris.png",
      alt: "Facial landmarks with iris detection zoom"
    },
    {
      title: "Pose + depth estimate sent to MRI system",
      image: "./assets/step-pose-depth-output.png",
      alt: "Pose and depth estimate packet"
    }
  ]
};

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

function bindText() {
  qsa("[data-bind]").forEach(el => {
    const key = el.getAttribute("data-bind");
    if (page[key]) el.textContent = page[key];
  });
}

function iconSvg(name) {
  const common = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

  if (name === "timer") return `
    <svg class="metric-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path ${common} d="M24 13v10l6 4"/>
      <path ${common} d="M18 5h12M24 5v5M13 9l-3 3M35 9l3 3"/>
      <circle ${common} cx="24" cy="27" r="16"/>
    </svg>`;

  if (name === "mesh") return `
    <svg class="metric-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path ${common} d="M16 14l8-5 9 5 4 11-5 12-8 4-9-4-5-12 6-11z"/>
      <path ${common} d="M16 14l8 10 9-10M15 37l9-13 8 13M10 25h28"/>
      ${[[16,14],[24,9],[33,14],[10,25],[38,25],[15,37],[24,24],[32,37]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="currentColor"/>`).join("")}
    </svg>`;

  return `
    <svg class="metric-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path ${common} d="M5 24s7-10 19-10 19 10 19 10-7 10-19 10S5 24 5 24z"/>
      <circle ${common} cx="24" cy="24" r="6"/>
      <path ${common} d="M11 9v5M37 9v5M11 39v-5M37 39v-5"/>
      <path ${common} d="M13 8h22M13 40h22"/>
    </svg>`;
}

function renderMetrics() {
  qs("#metricCards").innerHTML = page.metrics.map(item => `
    <article class="metric-card">
      ${iconSvg(item.icon)}
      <div>
        <div class="metric-value">${item.value}</div>
        <div class="metric-label">${item.label}</div>
      </div>
    </article>
  `).join("");
}

function connectorSvg() {
  return `<div class="connector" aria-hidden="true">
    <svg width="42" height="26" viewBox="0 0 42 26">
      <path d="M2 13h34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M28 5l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`;
}

function renderPipeline() {
  const cards = page.steps.map((step, i) => `
    <article class="step-card card">
      <div class="step-top">
        <span class="step-badge">${i + 1}</span>
        <span class="step-title">${step.title}</span>
      </div>
      <figure class="step-art">
        <img class="step-img illustration-img" src="${step.image}" alt="${step.alt}">
      </figure>
    </article>
  `);

  qs("#pipelineCards").innerHTML = [cards[0], connectorSvg(), cards[1], connectorSvg(), cards[2]].join("");
}

function init() {
  bindText();
  renderMetrics();
  renderPipeline();
}

document.addEventListener("DOMContentLoaded", init);
