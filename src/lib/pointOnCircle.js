export const pointOnCircle = radius => {
  const ang = Math.random() * 2 * Math.PI
  const hyp = Math.sqrt(Math.random()) * (radius / 2) + radius / 2

  const x = Math.cos(ang) * hyp
  const y = Math.sin(ang) * hyp

  return { x, y }
}
