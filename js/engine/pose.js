// A pose bends a straight band into a shape. It maps distance s along the band
// (mm, 0 at the centre) to a point and an orthonormal frame:
//   T along the band, N the band normal, B across the band (T x N).

export function makePose(kind, totalLength, bandWidth, lift = 0.75) {
  if (kind === 'loop') {
    // Standing ring on its edge, the classic product shot on a table.
    const R = (totalLength + 8) / (Math.PI * 2);
    const base = bandWidth / 2 + 0.05;
    return {
      kind,
      radius: R,
      at(s) {
        const a = s / R;
        const sin = Math.sin(a);
        const cos = Math.cos(a);
        return {
          px: R * sin, py: base, pz: R * cos,
          tx: cos, ty: 0, tz: -sin,
          nx: sin, ny: 0, nz: cos,
          bx: 0, by: -1, bz: 0,
        };
      },
    };
  }
  if (kind === 'wave') {
    // Lazy S curve lying on the table, the way a soft band falls when set down.
    const half = totalLength / 2;
    const amp = Math.min(13, totalLength * 0.09);
    const k = (Math.PI * 1.15) / half;
    return {
      kind,
      at(s) {
        const a = s * k;
        const y0 = amp * 0.5 * (1 - Math.cos(a)) * 0.38;
        const slopeY = amp * 0.5 * k * Math.sin(a) * 0.38;
        const z0 = amp * Math.sin(a * 0.5) * 0.9;
        const slopeZ = amp * 0.45 * k * Math.cos(a * 0.5);
        const len = Math.hypot(1, slopeY, slopeZ);
        const tx = 1 / len;
        const ty = slopeY / len;
        const tz = slopeZ / len;
        // Keep the band flat-ish: normal starts at world up, made orthogonal to T.
        const d = ty;
        let nx = -d * tx;
        let ny = 1 - d * ty;
        let nz = -d * tz;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        return {
          px: s, py: y0 + lift, pz: z0,
          tx, ty, tz,
          nx, ny, nz,
          bx: ty * nz - tz * ny, by: tz * nx - tx * nz, bz: tx * ny - ty * nx,
        };
      },
    };
  }
  // Default: a gently bowed strip. Centre rests on the table, ends lift off it,
  // which is how a stiff peyote band really lies and gives a shadow to read depth.
  const R = kind === 'flat' ? 1200 : 460;
  return {
    kind,
    radius: R,
    at(s) {
      const a = s / R;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      return {
        px: R * sin, py: R * (1 - cos) + lift, pz: 0,
        tx: cos, ty: sin, tz: 0,
        nx: -sin, ny: cos, nz: 0,
        bx: 0, by: 0, bz: 1,
      };
    },
  };
}
