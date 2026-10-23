// Code de dessin commun aux icônes et aux écrans de lancement (exécuté dans Chrome) : le nom est centré selon l'ENCRE de la calligraphie
// (et non selon la boîte de la police, qui est plus haute en dessous qu'au-dessus et faisait paraître le mot trop bas).
export const ART_JS = `
function fond(ctx, S, H){ const g = ctx.createRadialGradient(0.35 * S, 0.25 * H, 0, 0.35 * S, 0.25 * H, 0.794 * Math.max(S, H)); g.addColorStop(0, '#1b7a5c'); g.addColorStop(1, '#0b4a38'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, H); }
// dessine le mot centré (encre) en (cx, cy), avec une encre large de targetW ; renvoie le rectangle d'encre
function nom(ctx, text, cx, cy, targetW, fontName, color){
  ctx.font = '100px ' + fontName; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text), fs = 100 * targetW / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  ctx.font = fs + 'px ' + fontName; const k = ctx.measureText(text);
  const x = cx - (k.actualBoundingBoxRight - k.actualBoundingBoxLeft) / 2, y = cy - (k.actualBoundingBoxDescent - k.actualBoundingBoxAscent) / 2;
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  return {x0: x - k.actualBoundingBoxLeft, x1: x + k.actualBoundingBoxRight, y0: y - k.actualBoundingBoxAscent, y1: y + k.actualBoundingBoxDescent, fs};
}`;
