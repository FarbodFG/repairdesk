import { CanvasTexture, SRGBColorSpace } from 'three'

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  return { canvas, context }
}

function finish(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function createScreenTexture() {
  const { canvas, context: c } = surface(512, 1024)
  c.beginPath()
  c.roundRect(0, 0, 512, 1024, 60)
  c.clip()
  c.fillStyle = '#031d20'
  c.fillRect(0, 0, 512, 1024)
  const glow = c.createRadialGradient(340, 590, 15, 260, 560, 660)
  glow.addColorStop(0, '#39bda7')
  glow.addColorStop(0.35, '#126f68')
  glow.addColorStop(0.7, '#073c41')
  glow.addColorStop(1, '#04151f')
  c.fillStyle = glow
  c.fillRect(0, 0, 512, 1024)
  for (let i = 0; i < 7; i++) {
    c.beginPath()
    c.ellipse(375, 630, 150 + i * 48, 300 + i * 55, -0.7, 0, Math.PI * 2)
    c.strokeStyle = i === 2 ? '#edd3a2' : `rgba(146,255,223,${0.28 - i * 0.025})`
    c.lineWidth = i === 2 ? 3 : 1.5
    c.stroke()
  }
  c.textAlign = 'center'
  c.fillStyle = '#f4e9ce'
  c.font = '500 18px Arial'
  c.fillText('S U N   C I T Y', 256, 225)
  c.font = '600 100px Arial'
  c.fillText('09:41', 256, 345)
  c.font = '16px Arial'
  c.fillStyle = '#b3dfd5'
  c.fillText('A NEW LIFE. A NEW BEGINNING.', 256, 394)
  c.save()
  c.translate(256, 642)
  c.strokeStyle = '#f2d59f'
  c.lineWidth = 4
  c.beginPath()
  c.arc(0, 0, 44, 0, Math.PI * 2)
  c.stroke()
  for (let i = 0; i < 12; i++) {
    c.rotate(Math.PI / 6)
    c.beginPath()
    c.moveTo(0, 63)
    c.lineTo(0, 78)
    c.stroke()
  }
  c.restore()
  c.fillStyle = '#d6f6e9'
  c.font = '500 13px Arial'
  c.fillText('REPAIR  /  RECONNECT', 256, 902)
  c.fillStyle = '#e7f9ee'
  c.beginPath()
  c.roundRect(181, 981, 150, 6, 3)
  c.fill()
  return finish(canvas)
}

export function createBoardTexture() {
  const { canvas, context: c } = surface(512, 1024)
  c.beginPath()
  c.roundRect(0, 0, 512, 1024, 36)
  c.clip()
  c.fillStyle = '#063b32'
  c.fillRect(0, 0, 512, 1024)
  c.strokeStyle = '#277465'
  c.lineWidth = 2
  for (let i = 0; i < 16; i++) {
    const x = 30 + i * 29
    const offset = (i % 4) * 24
    c.beginPath()
    c.moveTo(x, 28)
    c.lineTo(x, 200 + offset)
    c.lineTo(256 + (x - 256) * 0.42, 290 + offset)
    c.lineTo(256 + (x - 256) * 0.42, 660 - offset)
    c.lineTo(x, 760 - offset)
    c.lineTo(x, 994)
    c.stroke()
    c.fillStyle = i % 3 === 0 ? '#e2c68a' : '#56aa8d'
    for (const y of [80 + offset, 852 - offset]) {
      c.beginPath()
      c.arc(x, y, 3, 0, Math.PI * 2)
      c.fill()
    }
  }
  c.strokeStyle = '#7ff2ca'
  c.lineWidth = 3
  for (const x of [75, 437]) {
    c.beginPath()
    c.moveTo(x, 150)
    c.lineTo(x, 400)
    c.lineTo(256, 510)
    c.lineTo(x, 650)
    c.lineTo(x, 900)
    c.stroke()
  }
  return finish(canvas)
}
