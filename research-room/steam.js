// Overlapping soft vapor parcels spread and dissolve as they rise.
export function drawSteam(ctx, x, y, height, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(height, height);
  for (let i = 0; i < 15; i++) {
    const age = (time / 4100 + i / 15) % 1;
    const drift = Math.sin(age * 6.1 - time / 1900) * age * .087;
    const curl = Math.sin(i * 2.4 + age * 4.5) * (.011 + .05 * age);
    const centerX = drift + curl + age * age * .066;
    const centerY = -.82 * age;
    const radius = .035 + age * .133;
    const opacity = .145 * Math.sin(Math.PI * age) * (1 - age * .68);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(drift * 3.4);
    ctx.scale(.79, 1.22);
    const plume = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    plume.addColorStop(0, `rgba(242,246,249,${opacity})`);
    plume.addColorStop(.45, `rgba(238,243,247,${opacity * .54})`);
    plume.addColorStop(1, 'rgba(234,240,245,0)');
    ctx.fillStyle = plume;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  }
  ctx.restore();
}
