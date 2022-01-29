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

class Player {
  constructor(engine) {
    this.engine = engine

    this.score = 0
    this.lives = 3
  }

  addScore(val) {
    this.score += val
  }

  getHit() {
    this.lives -= 1
    if (this.lives === 0) {
      this.engine.gameOver()
    }
  }
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

    this.tempMatrix = new THREE.Matrix4()

    this.player = new Player(this)

    this.audioElement = document.getElementById('audio-ambient')

    this.onSelectStart = this.onSelectStart.bind(this)
    this.onWindowResize = this.onWindowResize.bind(this)
    this.render = this.render.bind(this)
    this.onSessionEnd = this.onSessionEnd.bind(this)
  }

  async init() {
    const loader = new GLTFLoader()

    const assets = {
      env: await promisifiedLoad({ loader, file: 'env.glb' }),
      hit: await promisifiedLoad({ loader, file: 'assets.glb' }),
    }

    // load a sound and set it as the Audio object's buffer
    const audioLoader = new THREE.AudioLoader();

    this.buffer = await promisifiedLoad({ loader: audioLoader, file: 'music/gameover-or-replay.mp3' })

    this.loading.classList.add('hidden')

    this.createScene()
    this.createRenderer()
    this.createCamera()

    this.createEnvironment(assets)
    this.createLights()
    this.createFog()

    this.createInitAudio()

    this.createSkybox({ color: 0x343e62, layer: 1 })
    this.createSkybox({ color: 0xff0057, layer: 2 })

    this.createVRButton()

    // this.createBgItems(assets)
    this.createClickables(assets)

    window.addEventListener('resize', this.onWindowResize, false)

    this.createControllers()
  }

  createScene() {
    const scene = new THREE.Scene()
    this.scene = scene
  }

  createFog() {
    const fog = new THREE.FogExp2(0x5d26ff, 0.01)
    this.scene.fog = fog
  }

  createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)

    renderer.xr.enabled = true

    renderer.xr.addEventListener('sessionend', this.onSessionEnd)

    document.body.appendChild(renderer.domElement)

    this.renderer = renderer
  }

  onSessionEnd() {
    this.audioElement.pause()
    setTimeout(() => {
      this.sound.pause()
      this.sound.setVolume(1)
    }, 1000)
  }

  createVRButton() {
    const button = VRButton.createButton(this)

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

  createInitAudio() {
    // create an AudioListener and add it to the camera
    const listener = new THREE.AudioListener()
    this.camera.add(listener)

    // create a global audio source
    const sound = new THREE.Audio(listener)

    sound.setBuffer(this.buffer);
    sound.setLoop(true)
    sound.setVolume(0.5)

    this.sound = sound
  }

  createLights() {
    const dirLight = new THREE.DirectionalLight(0xfffdd8, 2)
    dirLight.position.set(1, 1, 1).normalize()

    const ambLight = new THREE.AmbientLight(0xfffdd8, 2)

    this.scene.add(dirLight, ambLight)
  }

  createSkybox({ color, layer }) {
    const geo = new THREE.SphereGeometry(100, 64, 64)
    const mat = new THREE.MeshPhongMaterial({ color, side: THREE.BackSide })

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

  createClickables(assets) {
    const clickableParent = new THREE.Object3D()
    clickableParent.name = 'clickableParent'
    this.clickableParent = clickableParent

    const clickables = []

    const L = assets.hit.scene.getObjectByName('hit_L')
    const R = assets.hit.scene.getObjectByName('hit_R')

    const children = []
    L.traverse(nodeL => {
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

        clickableParent.add(clone)
      }
    })

    this.clickables = shuffleArray(clickables)
    this.scene.add(clickableParent)
  }

  renderClickables({ delta, time }) {
    this.spawnedClickables.forEach(clickable => {
      clickable.position.z += delta * config.clickable.speedMultiplier

      if (clickable.position.z > 50) {
        clickable.position.z = -12
      }
    })

    if (this.nextClickableTime < time) {
      const { addSpawnTime, maxSpawnTime } = config.clickable
      this.nextClickableTime = time + Math.random() * maxSpawnTime + addSpawnTime

      const clickable = this.clickables[this.currentClickableId]
      const dir = Math.random() > 0.5 ? 1 : -1
      clickable.position.x = Math.random() * dir
      clickable.position.y = 1.2 + Math.random() * dir
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
    controller.addEventListener('selectstart', this.onSelectStart)
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

  onSelectStart(e) {
    const controller = e.target

    this.tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, - 1).applyMatrix4(this.tempMatrix);

    const intersections = this.raycaster.intersectObjects(this.scene.children, true)

    let foundHit = false
    intersections.forEach(intersection => {
      if (foundHit) {
        return
      }

      const { object } = intersection
      if (object.name.startsWith('hit')) {
        foundHit = true
        object.position.x = 10000
      }
    })
  }

  buildController(data) {
    const { targetRayMode } = data
    this.targetRayMode = targetRayMode

    this.raycaster = new THREE.Raycaster()
    this.raycaster.layers.enable(1)
    this.raycaster.layers.enable(2)

    if (targetRayMode === 'tracked-pointer') {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3))
      geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3))

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

  startGame(session) {
    this.session = session
    this.renderer.setAnimationLoop(this.render)

    this.sound.play()

    setTimeout(() => {
      this.sound.setVolume(0.3)
      this.audioElement.play()
    }, 2000)
  }

  gameOver() {
    console.error("GAME OVER")
    // dissolve all hit items
    // spawn game over / replay screen
    // add buttons for "replay" and "game over"
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render(time) {
    const { camera, clock, renderer, scene, lastSpawnTime = 0 } = this

    const delta = clock.getDelta()

    // this.renderBgItems(delta)
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
