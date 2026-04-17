export function screenToComplex(viewport, width, height, x, y) {
  const aspect = width / Math.max(height, 1);
  const spanX = viewport.spanY * aspect;
  const left = viewport.centerX - spanX / 2;
  const top = viewport.centerY + viewport.spanY / 2;
  return {
    x: left + (x / width) * spanX,
    y: top - (y / height) * viewport.spanY,
  };
}

export function zoomViewport(viewport, width, height, x, y, zoomFactor) {
  const focus = screenToComplex(viewport, width, height, x, y);
  const nextSpanY = viewport.spanY * zoomFactor;
  const aspect = width / Math.max(height, 1);
  const spanX = nextSpanY * aspect;
  const nextLeft = focus.x - (x / width) * spanX;
  const nextTop = focus.y + (y / height) * nextSpanY;
  return {
    centerX: nextLeft + spanX / 2,
    centerY: nextTop - nextSpanY / 2,
    spanY: nextSpanY,
  };
}

export function panViewport(viewport, width, height, dx, dy) {
  const aspect = width / Math.max(height, 1);
  const spanX = viewport.spanY * aspect;
  return {
    centerX: viewport.centerX - (dx / width) * spanX,
    centerY: viewport.centerY + (dy / height) * viewport.spanY,
    spanY: viewport.spanY,
  };
}
