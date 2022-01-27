import * as THREE from 'three'

import { VRButton } from './VRButton.js'

class Engine {
  constructor() {
  }

  async init() {
    if (navigator.xr) {
      // If the device allows creation of exclusive sessions set it as the
      // target of the 'Enter XR' button.
      const supported = await navigator.xr.isSessionSupported('immersive-vr')
      this.XR = supported
    }


    this.createRenderer()

    const render1 = this.createScene({ color: 'green' })
    const render2 = this.createScene({ color: 'red' })

    this.cameraL = render1.camera
    this.scene1 = render1.scene
    this.scene1.background = new THREE.Color('blue')

    this.cameraR = render2.camera
    this.scene2 = render2.scene

    // Handle browser resize
    window.addEventListener('resize', this.onWindowResize.bind(this), false)

    const geo = new THREE.BoxBufferGeometry(1, 1, 1)
    const mat1 = new THREE.MeshLambertMaterial({ color: 'red' })
    const mat2 = new THREE.MeshLambertMaterial({ color: 'green' })

    // Make a red model
    const modelL = new THREE.Mesh(geo, mat1)
    modelL.position.set(0.34, 1.5, -10)
    this.scene1.add(modelL)

    // Make a green model
    const modelR = new THREE.Mesh(geo, mat2)
    modelR.position.set(-0.34, 1.5, -10)
    this.scene2.add(modelR)

    this.modelL = modelL
    this.modelR = modelR

    document.body.appendChild(VRButton.createButton(this.renderer))
    // this.addFullScreenButton()

    // Set animation loop
    this.renderer.setAnimationLoop(this.render.bind(this))
  }

  addFullScreenButton() {
    const fullScreenButton = document.createElement('button')
    fullScreenButton.innerText = 'Fullscreen'
    fullScreenButton.addEventListener('click', this.requestFullscreen.bind(this))

    fullScreenButton.style.position = 'fixed'
    fullScreenButton.style.top = 0
    fullScreenButton.style.padding = '1em'

    document.body.appendChild(fullScreenButton)
  }

  createSkybox({ color, scene }) {
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })

    const geo = new THREE.SphereGeometry(100, 64, 64)
    const skyBox = new THREE.Mesh(geo, mat)
    scene.add(skyBox)
  }

  createScene({ color = 0x505050 }) {
    // Make a new scene
    const scene = new THREE.Scene()
    // Set background color of the scene to gray
    // scene.background = new THREE.Color(color)

    // Make a camera. note that far is set to 100, which is better for realworld sized environments
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200)
    camera.position.set(0, 1.6, 0)
    scene.add(camera)

    // Add some lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5)
    dirLight.position.set(1, 1, 1).normalize()
    scene.add(dirLight)

    const ambLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambLight)

    scene.background = null

    this.createSkybox({ color, scene })

    return {
      scene,
      camera,
    }
  }

  createRenderer() {
    // Make a renderer that fills the screen
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    // Turn on VR support
    renderer.xr.enabled = true

    // Add canvas to the page
    document.body.appendChild(renderer.domElement)

    this.renderer = renderer
  }

  onWindowResize() {
    this.cameraL.aspect = window.innerWidth / window.innerHeight
    this.cameraL.updateProjectionMatrix()
    this.cameraR.aspect = window.innerWidth / window.innerHeight
    this.cameraR.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  async requestFullscreen() {
    // if (this.XR) {
    //   const session = await navigator.xr.requestSession('immersive-vr')
    //   const refSpace = await session.requestReferenceSpace('local')

    //   this.renderer.xr.setSession(session)
    // }

    const elem = this.renderer.domElement

    if (elem.requestFullscreen) {
      elem.requestFullscreen()
    } else if (elem.webkitRequestFullscreen) { /* Safari */
      elem.webkitRequestFullscreen()
    } else if (elem.msRequestFullscreen) { /* IE11 */
      elem.msRequestFullscreen()
    }

    this.onWindowResize()
  }

  render(time) {
    const { renderer, modelL, modelR, scene1, scene2, cameraL, cameraR } = this
    const width = window.innerWidth
    const height = window.innerHeight
    const halfWidth = width / 2

    // Rotate the model
    modelL.rotation.y = time / 1000
    modelR.rotation.y = time / 1000

    renderer.autoClear = true;

    renderer.setViewport(0, 0, halfWidth, height)

    // Draw everything
    renderer.render(scene1, cameraL)

    // prevent canvas from being erased with next .render call
    renderer.autoClear = false

    renderer.setViewport(halfWidth, 0, halfWidth, height)

    // just render scene2 on top of scene1
    renderer.render(scene2, cameraR)
  }
}

const main = async () => {
  const engine = new Engine()
  await engine.init()
}

main()