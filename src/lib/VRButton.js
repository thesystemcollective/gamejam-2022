class VRButton {
  static createButton(renderer) {
    const button = document.createElement('button')
    button.id = 'VRButton'

    function showEnterVR(/*device*/) {
      let currentSession = null

      async function onSessionStarted(session) {
        session.addEventListener('end', onSessionEnded)

        await renderer.xr.setSession(session)
        button.textContent = 'EXIT VR'

        currentSession = session
      }

      function onSessionEnded(/*event*/) {
        currentSession.removeEventListener('end', onSessionEnded)

        button.textContent = 'ENTER VR'

        currentSession = null
      }

      button.textContent = 'ENTER VR'

      button.onclick = function () {
        if (currentSession === null) {
          // WebXR's requestReferenceSpace only works if the corresponding feature
          // was requested at session creation time. For simplicity, just ask for
          // the interesting ones as optional features, but be aware that the
          // requestReferenceSpace call will fail if it turns out to be unavailable.
          // ('local' is always available for immersive sessions and doesn't need to
          // be requested separately.)

          const sessionInit = {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
          }
          navigator.xr.requestSession('immersive-vr', sessionInit).then(onSessionStarted)
        } else {
          currentSession.end()
        }
      }
    }

    function disableButton() {
      button.classList.add('disabled')

      button.onmouseenter = null
      button.onmouseleave = null

      button.onclick = null
    }

    function showWebXRNotFound() {
      disableButton()

      button.textContent = 'VR NOT SUPPORTED'
    }

    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-vr').then(function (supported) {
        supported ? showEnterVR() : showWebXRNotFound()

        if (supported && VRButton.xrSessionIsGranted) {
          button.click()
        }
      })

      return button
    } else {
      const message = document.createElement('a')
      message.id = 'VRButtonMessage'

      if (window.isSecureContext === false) {
        message.href = document.location.href.replace(/^http:/, 'https:')
        message.innerHTML = 'WEBXR NEEDS HTTPS' // TODO Improve message
      } else {
        message.href = 'https://immersiveweb.dev/'
        message.innerHTML = 'WEBXR NOT AVAILABLE'
      }

      return message
    }
  }

  static xrSessionIsGranted = false

  static registerSessionGrantedListener() {
    if ('xr' in navigator) {
      navigator.xr.addEventListener('sessiongranted', () => {
        VRButton.xrSessionIsGranted = true
      })
    }
  }
}

VRButton.registerSessionGrantedListener()

export { VRButton }
