import * as THREE from 'three'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory'

import { pointOnCircle, promisifiedLoad, shuffleArray, Laser, VRButton } from './lib/index.js'

const config = {
  player: {
    // time between shots
    reload: 1000,
  },

  spawnCounts: {
    // how many shot prefabs should be created
    shots: 100,
  },

  // how much time should between clickale spawns
  clickable: {
    maxSpawnTime: 500,
    addSpawnTime: 1000,
    speedMultiplier: 0.5,
  },
}

class Engine {
  constructor() {
    this.gui = document.getElementById('gui')

    this.loading = document.getElementById('loading')
    this.loading.classList.remove('hidden')

    this.VRButton = document.getElementById('VRButton')

    this.clock = new THREE.Clock()

    this.shotVec = new THREE.Vector3()
    this.lastShotId = 0
    this.nextShotTime = -1

    this.nextClickableTime = 1000
    this.currentClickableId = 0
    this.spawnedClickables = []

    this.onSelectEnd = this.onSelectEnd.bind(this)
    this.onSelectStart = this.onSelectStart.bind(this)
    this.onWindowResize = this.onWindowResize.bind(this)
    this.render = this.render.bind(this)
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

    this.createSkybox({ color: 0x343e62, layer: 1 })
    this.createSkybox({ color: 0xff0057, layer: 2 })

    this.createVRButton()

    this.createEnvironment(assets)
    this.createBgItems(assets)
    this.createClickables(assets)

    window.addEventListener('resize', this.onWindowResize, false)

    this.createControllers()
    this.createShots()

    this.renderer.setAnimationLoop(this.render)
  }

  createScene() {
    const scene = new THREE.Scene()
    const fog = new THREE.FogExp2(0x5d26ff, 0.01)
    scene.fog = fog

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
    const geo = new THREE.SphereGeometry(50, 64, 64)
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
        if (node.name.endsWith('_L')) {
          const name = node.name.replace('_L', '')
          materials[name] = node.material
        } else {
          const name = node.name.replace('_R', '')
          meshes[name] = node
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
        // meshL.rotation.z = 3
        this.tunnels.push(meshL, meshR)
      }

      this.scene.add(meshL, meshR)
    })
  }

  renderEnvironment(time) {
    this.planets.forEach(planet => {
      planet.rotation.y = time / 10_000
    })

    this.tunnels.forEach(tunnel => {
      tunnel.rotation.z = time / 300_000
    })
  }

  createBgItems(assets) {
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

  renderBgItems(delta) {
    this.bgItems.forEach(({ node, speed, pos }) => {
      if (node.position.z > 100) {
        node.position.z = pos
      } else {
        node.position.z += speed * delta
      }
    })
  }

  createClickables(assets) {
    const clickables = []

    const L = assets.hit.scene.getObjectByName('hit_L')
    const R = assets.hit.scene.getObjectByName('hit_R')

    const children = []
    L.children.forEach(nodeL => {
      const name = nodeL.name.replace('_L', '_R')
      const nodeR = R.getObjectByName(name)

      nodeL.layers.set(1)
      nodeR.layers.set(2)

      const group = [nodeL, nodeR]
      children.push(group)
    })

    children.forEach(([nodeL, nodeR]) => {
      const parent = new THREE.Object3D()
      nodeL.position.set(0, 0, 0)
      nodeR.position.set(0, 0, 0)
      parent.add(nodeL, nodeR)
      parent.name = nodeL.name.replace('_L', '')

      for (let i = 0; i < 10; i++) {
        const clone = parent.clone()
        clickables.push(clone)

        clone.position.x = 10_000

        this.scene.add(clone)
      }
    })

    this.clickables = shuffleArray(clickables)
  }

  renderClickables({ delta, time }) {
    this.spawnedClickables.forEach(clickable => {
      clickable.position.z += delta * config.clickable.speedMultiplier
    })

    if (this.nextClickableTime < time) {
      const { addSpawnTime, maxSpawnTime } = config.clickable
      this.nextClickableTime = time + Math.random() * maxSpawnTime + addSpawnTime

      const clickable = this.clickables[this.currentClickableId]
      const dir = Math.random() > 0.5 ? 1 : -1
      clickable.position.x = Math.random() * dir
      clickable.position.z = -12

      this.spawnedClickables.push(clickable)

      this.currentClickableId += 1
      if (this.currentClickableId >= this.clickables.length) {
        this.currentClickableId = 0
      }
    }
  }

  createControllers() {
    const { scene } = this

    const controllerModelFactory = new XRControllerModelFactory()

    const controller1 = this.createControl(0, controllerModelFactory)

    scene.add(controller1)

    const controller2 = this.createControl(1, controllerModelFactory)

    scene.add(controller2)

    this.controller1 = controller1
    this.controller2 = controller2
  }

  createControl(id, controllerModelFactory) {
    const { renderer, scene } = this

    const controller = renderer.xr.getController(id)
    controller.userData.isSelecting = false
    controller.addEventListener('selectstart', e => this.onSelectStart({ e, controller }))
    controller.addEventListener('selectend', e => this.onSelectEnd({ e, controller }))
    controller.addEventListener('connected', event => {
      controller.add(this.buildController(event.data))
    })

    controller.addEventListener('disconnected', () => {
      controller.remove(controller.children[0])
    })

    const grip = renderer.xr.getControllerGrip(id)
    grip.add(controllerModelFactory.createControllerModel(grip))
    scene.add(grip)

    return controller
  }

  onSelectStart({ controller }) {
    controller.userData.isSelecting = true
  }

  onSelectEnd({ controller }) {
    controller.userData.isSelecting = false
  }

  buildController(data) {
    const { targetRayMode } = data

    if (targetRayMode === 'tracked-pointer') {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3))
      geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3))

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
      })

      return new THREE.Line(geometry, material)
    } else if (targetRayMode === 'gaze') {
      const geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1)
      const material = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true })
      return new THREE.Mesh(geometry, material)
    }
  }

  renderController({ time, controller }) {
    if (controller.userData.isSelecting) {
      if (this.nextShotTime < time) {
        this.nextShotTime = time + config.player.reload

        this.lastShotId += 1

        if (this.lastShotId >= this.shots.length) {
          this.lastShotId = 0
        }

        const object = this.shots[this.lastShotId]

        const position = controller.position.clone()
        position.z -= 1
        position.applyQuaternion(controller.quaternion)
        object.position.copy(position)

        object.userData.velocity = new THREE.Vector3(0, 0, -1)

        object.userData.velocity.applyQuaternion(controller.quaternion)
      }
    }
  }

  createShots() {
    this.shots = []

    for (let i = 0; i < config.spawnCounts.shots; i++) {
      const geo = new THREE.SphereGeometry(0.1, 32, 32)
      const mat = new THREE.MeshBasicMaterial({ color: 'orange' })
      const shot = new THREE.Mesh(geo, mat)
      shot.position.x = 10000

      shot.userData.velocity = new THREE.Vector3()

      this.scene.add(shot)

      this.shots.push(shot)
    }
  }

  renderShots(delta) {
    this.shots.forEach(shot => {
      this.shotVec.x = shot.userData.velocity.x * delta
      this.shotVec.y = shot.userData.velocity.y * delta
      this.shotVec.z = shot.userData.velocity.z * delta

      shot.position.add(this.shotVec)
    })
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render(time) {
    const { camera, clock, renderer, scene, lastSpawnTime = 0 } = this

    const delta = clock.getDelta()

    this.renderController({ delta, time, controller: this.controller1 })
    this.renderController({ delta, time, controller: this.controller2 })

    this.renderShots(delta)

    this.renderBgItems(delta)
    this.renderEnvironment(time)
    this.renderClickables({ delta, time })

    renderer.render(scene, camera)
  }
}

const main = async () => {
  const engine = new Engine()
  await engine.init()
}

main()
