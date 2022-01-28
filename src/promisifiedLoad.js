// Load a resource, the Preload class handles notifications.
export const promisifiedLoad = ({ loader, file }) =>
  new Promise((resolve, reject) => {
    const onProgress = xhr => {
      // let loadPercentString = ''
      // let totalString = ''
      // if (xhr.lengthComputable) {
      //   const loadPercent = Math.ceil((xhr.loaded / xhr.total) * 100)
      //   loadPercentString = `${loadPercent}% `

      //   totalString = `/${xhr.total}`
      // }
    }

    const onDone = result => {
      resolve(result)
    }

    const onError = e => {
      console.log('error loading file', file, e)
      reject(e)
    }

    loader.load(file, onDone, onProgress, onError)
  })
