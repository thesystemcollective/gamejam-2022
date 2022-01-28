import * as THREE from 'three'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';

import { pointOnCircle, promisifiedLoad, shuffleArray, VRButton } from './lib/index.js'

class Engine {
  constructor() {
    this.gui = document.getElementById('gui')

    this.loading = document.getElementById('loading')
    this.loading.classList.remove('hidden')

    this.VRButton = document.getElementById('VRButton')

    this.clock = new THREE.Clock()
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

    this.createClickables(assets)
    this.createEnvironment(assets)
    this.createBackgroundFloaters(assets)

    window.addEventListener('resize', this.onWindowResize.bind(this), false)

    this.createControllers()

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

  createBackgroundFloaters(assets) {
    const parent = assets.hit.scene.getObjectByName('bg')

    const bgItems = []

    parent.traverse(node => {
      for (let i = 0; i < 20; i++) {
        const newNode = node.clone()

        // 150 to 180 meters from the player
        const distanceZ = -1 * (Math.random() * 150)

        const pos = pointOnCircle(10)

        newNode.position.set(pos.x, pos.y, distanceZ)

        // 0.05 - 0.1 movement speed
        const speed = Math.random() * 0.5 + 0.5

        const layer = (i % 2) + 1
        newNode.layers.set(layer)

        bgItems.push({ node: newNode, pos: distanceZ, speed })

        this.scene.add(newNode)
      }
    })

    this.bgItems = bgItems
  }

  createClickables(assets) {
    const clickables = []

    assets.hit.scene.traverse(node => {
      if (node.parent && node.parent.name && node.parent.name === 'replay') {
        const adjacent = assets.hit.scene.getObjectByName(node.name.replace('_replay', '_over'))
        clickables.push([node, adjacent])
      }
    })

    this.clickables = shuffleArray(clickables)
  }

  createControllers() {
    const { renderer, scene } = this

    const controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
    controller1.addEventListener('selectend', this.onSelectEnd.bind(this));
    controller1.addEventListener('connected', (event) => {
      controller1.add(this.buildController(event.data))
    })

    controller1.addEventListener('disconnected', () => {
      controller1.remove(controller1.children[0])
    })

    scene.add(controller1)

    const controller2 = renderer.xr.getController(1)
    controller2.addEventListener('selectstart', this.onSelectStart.bind(this))
    controller2.addEventListener('selectend', this.onSelectEnd.bind(this))
    controller2.addEventListener('connected', (event) => {
      controller2.add(this.buildController(event.data))
    });

    controller2.addEventListener('disconnected', () => {
      controller2.remove(this.children[0]);
    })

    scene.add(controller2)

    // The XRControllerModelFactory will automatically fetch controller models
    // that match what the user is holding as closely as possible. The models
    // should be attached to the object returned from getControllerGrip in
    // order to match the orientation of the held device.

    const controllerModelFactory = new XRControllerModelFactory()

    const controllerGrip1 = renderer.xr.getControllerGrip(0)
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
    scene.add(controllerGrip1)

    const controllerGrip2 = renderer.xr.getControllerGrip(1)
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
    scene.add(controllerGrip2)

    this.controller1 = controller1
    this.controller2 = controller2
  }

  onSelectStart(e) {
    console.log({ e })
  }

  onSelectEnd(e) {
    console.log({ e })
  }

  buildController(data) {
    const { targetRayMode } = data

    if (targetRayMode === 'tracked-pointer') {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, - 1], 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));

      const material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending });
      return new THREE.Line(geometry, material)
    } else if (targetRayMode === 'gaze') {
      const geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, - 1);
      const material = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true });
      return new THREE.Mesh(geometry, material);
    }
  }


  // createCubes() {
  //   const geo = new THREE.BoxBufferGeometry(1, 1, 1)
  //   const mat1 = new THREE.MeshLambertMaterial({ color: 'red' })
  //   const mat2 = new THREE.MeshLambertMaterial({ color: 'green' })

  //   const modelL = new THREE.Mesh(geo, mat1)
  //   modelL.position.set(0, 1.5, -10)
  //   modelL.layers.set(1)

  //   const modelR = new THREE.Mesh(geo, mat2)
  //   modelR.position.set(0, 1.5, -10)
  //   modelR.layers.set(2)

  //   this.scene.add(modelL, modelR)

  //   this.modelL = modelL
  //   this.modelR = modelR
  // }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render(time) {
    const { camera, clock, renderer, scene, lastSpawnTime = 0 } = this

    const delta = clock.getDelta()

    this.planets.forEach(planet => {
      planet.rotation.y = time / 10_000
    })

    this.tunnels.forEach(tunnel => {
      tunnel.rotation.z = time / 300_000
    })

    this.bgItems.forEach(({ node, speed, pos }) => {
      if (node.position.z > 100) {
        node.position.z = pos
      } else {
        node.position.z += speed * delta
      }
    })

    renderer.render(scene, camera)
  }
}

const main = async () => {
  const engine = new Engine()
  await engine.init()
}

main()