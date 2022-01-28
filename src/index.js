import * as THREE from 'three'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

import { pointOnCircle, promisifiedLoad, shuffleArray, VRButton } from './lib/index.js'

class Engine {
  constructor() {
    this.gui = document.getElementById('gui')

    this.loading = document.getElementById('loading')
    this.loading.classList.remove('hidden')

    this.VRButton = document.getElementById('VRButton')
  }

  async init() {
    const loader = new GLTFLoader()

    const assets = {
      env: await promisifiedLoad({ loader, file: 'env.glb' }),
      hit: await promisifiedLoad({ loader, file: 'assets.glb' }),
    }

    this.loading.classList.add('hidden')

    this.createScene()

    this.createRenderer()

    this.createCamera()

    this.createLights()

    this.createSkybox({ color: 0x343E62, layer: 1 })
    this.createSkybox({ color: 0xff0057, layer: 2 })

    this.createVRButton()

    this.createEnvironment(assets)

    // this.createCubes()

    window.addEventListener('resize', this.onWindowResize.bind(this), false)

    this.renderer.setAnimationLoop(this.render.bind(this))
  }

  createScene() {
    const scene = new THREE.Scene()
    scene.background = null

    this.scene = scene
  }

  createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)

    renderer.xr.enabled = true

    document.body.appendChild(renderer.domElement)

    this.renderer = renderer
  }

  createVRButton() {
    const button = VRButton.createButton(this.renderer)

    this.VRButton.classList.remove('hidden')

    this.VRButton.appendChild(button)
  }

  createCamera() {
    const fov = 50
    const aspect = window.innerWidth / window.innerHeight
    const near = 0.1
    const far = 200
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

    camera.position.set(0, 1.6, 0)

    this.scene.add(camera)

    this.camera = camera
  }

  createLights() {
    const dirLight = new THREE.DirectionalLight(0xfffdd8, 0.9)
    dirLight.position.set(1, 1, 1).normalize()

    const ambLight = new THREE.AmbientLight(0xfffdd8, 0.9)

    this.scene.add(dirLight, ambLight)
  }

  createSkybox({ color, layer }) {
    const geo = new THREE.SphereGeometry(100, 64, 64)
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })

    const skyBox = new THREE.Mesh(geo, mat)

    skyBox.layers.set(layer)

    this.scene.add(skyBox)
  }

  createEnvironment(assets) {
    const meshes = {}
    const materials = {}
    this.planets = []
    this.tunnels = []

    assets.env.scene.traverse(node => {
      if (node.isMesh) {
        if (node.name.endsWith('_over') || node.name.endsWith('_mat')) {
          const name = node.name.replace('_over', '').replace('_mat', '')
          materials[name] = node.material
        } else {
          meshes[node.name] = node
        }
      }
    })

    Object.entries(meshes).forEach(([name, mesh]) => {
      const meshR = mesh
      meshR.layers.set(2)
      meshR.name = name + 'R'

      const meshL = mesh.clone()
      meshL.material = materials[name]
      meshL.layers.set(1)
      meshL.name = name + 'L'

      if (name.startsWith('planet')) {
        this.planets.push(meshL, meshR)
      }

      if (name.startsWith('tunnel')) {
        this.tunnels.push(meshL, meshR)
      }

      this.scene.add(meshL, meshR)
    })
  }

  createCubes() {
    // const geo = new THREE.BoxBufferGeometry(1, 1, 1)
    // const mat1 = new THREE.MeshLambertMaterial({ color: 'red' })
    // const mat2 = new THREE.MeshLambertMaterial({ color: 'green' })

    // const modelL = new THREE.Mesh(geo, mat1)
    // modelL.position.set(0, 1.5, -10)
    // modelL.layers.set(1)

    // const modelR = new THREE.Mesh(geo, mat2)
    // modelR.position.set(0, 1.5, -10)
    // modelR.layers.set(2)

    // this.scene.add(modelL, modelR)

    // this.modelL = modelL
    // this.modelR = modelR
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    // this.cameraR.aspect = window.innerWidth / window.innerHeight
    // this.cameraR.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render(time) {
    const { camera, renderer, scene } = this

    this.planets.forEach(planet => {
      planet.rotation.y = time / 10_000
    })

    this.tunnels.forEach(tunnel => {
      tunnel.rotation.z = time / 300_000
    })

    renderer.render(scene, camera)
  }
}

const main = async () => {
  const engine = new Engine()
  await engine.init()
}

main()