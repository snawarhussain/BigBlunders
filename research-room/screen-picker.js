import {Ray, Vector3} from './room-runtime.js';

// The original bundle tree-shook Raycaster. The mesh intersection methods
// remain available, so only the perspective ray and nearest-hit selection are needed.
export function createScreenPicker(model, screens) {
  const ray = new Ray();
  const origin = new Vector3();
  const direction = new Vector3();
  const query = {ray, near: 0, far: Infinity};
  const meshes = [];
  model.traverseVisible((object) => { if (object.isMesh) meshes.push(object); });

  function closestHit(candidates) {
    const hits = [];
    for (const mesh of candidates) mesh.raycast(query, hits);
    return hits.reduce((closest, hit) => (!closest || hit.distance < closest.distance) ? hit : closest, null);
  }

  return (x, y, camera) => {
    origin.setFromMatrixPosition(camera.matrixWorld);
    direction.set(x, y, .5).unproject(camera).sub(origin).normalize();
    ray.set(origin, direction);
    const screen = closestHit(screens);
    if (!screen) return;
    const hit = closestHit(meshes);
    if (hit?.object === screen.object) return screen;
  };
}
