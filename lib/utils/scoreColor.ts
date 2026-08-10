export function overallColor(v: number) {
  if (v >= 80) return "#1A6B3C";
  if (v >= 65) return "#9A7A00";
  if (v >= 50) return "#3D7EA6";
  return "#C0392B";
}

export function scoreStars(v: number) {
  if (v >= 80) return 3;
  if (v >= 65) return 2;
  if (v >= 50) return 1;
  return 0;
}
