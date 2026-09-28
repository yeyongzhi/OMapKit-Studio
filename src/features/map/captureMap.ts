import type { Map as KitMap } from 'openlayers-map-kit'

function waitForRender(map: KitMap): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const listenerId = map.once('map:rendercomplete', () => finish())
    const timeoutId = window.setTimeout(finish, 1800)

    function finish() {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      map.un(listenerId)
      resolve()
    }

    map.renderSync()
  })
}

export async function captureMap(map: KitMap, element: HTMLElement): Promise<void> {
  await waitForRender(map)

  const width = element.clientWidth
  const height = element.clientHeight
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (!context) throw new Error('浏览器无法创建截图画布。')

  const layers = element.querySelectorAll<HTMLCanvasElement>('.ol-layer canvas, canvas.ol-layer')
  if (layers.length === 0) throw new Error('地图画布尚未准备好，请稍后重试。')

  context.fillStyle = '#f5f4ef'
  context.fillRect(0, 0, width, height)

  for (const canvas of layers) {
    if (!canvas.width || !canvas.height) continue
    const parent = canvas.parentElement
    const opacity = parent?.style.opacity || canvas.style.opacity
    context.globalAlpha = opacity ? Number(opacity) : 1

    if (canvas.style.transform) {
      const transform = new DOMMatrix(canvas.style.transform)
      context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f)
    } else {
      context.setTransform(canvas.clientWidth / canvas.width, 0, 0, canvas.clientHeight / canvas.height, 0, 0)
    }

    context.drawImage(canvas, 0, 0)
  }

  context.setTransform(1, 0, 0, 1, 0, 0)
  const image = output.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = image
  link.download = `omap-hangzhou-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.png`
  link.click()
}
