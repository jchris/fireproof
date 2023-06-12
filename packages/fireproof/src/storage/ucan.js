// import fetch from 'cross-fetch'
import { Base } from './base.js'

const defaultConfig = {
  // url: 'http://localhost:4000'
}

export class Ucan extends Base {
  constructor (name, config = {}) {
    super(name, Object.assign({}, defaultConfig, config))
    // console.log('Ucan', name, config)
    // at this point we are going to extend the ready handler to upload the history if theres no header
  }

  headerURL (branch = 'main') {
    return `${this.config.url}/${branch}.json`
  }

  async writeCars (cars) {
    if (this.config.readonly) return
    for (const { cid, bytes } of cars) {
      const carURL = `${this.config.url}/${cid.toString()}.car`
      const response = await fetch(carURL, {
        method: 'PUT',
        body: bytes,
        headers: { 'Content-Type': 'application/car' }
      })
      if (!response.ok) throw new Error(`An error occurred: ${response.statusText}`)
    }
  }

  async readCar (carCid) {
    const carURL = `${this.config.url}/${carCid.toString()}.car`
    const response = await fetch(carURL)
    if (!response.ok) throw new Error(`An error occurred: ${response.statusText}`)
    const got = await response.arrayBuffer()
    return new Uint8Array(got)
  }

  async loadHeader (branch = 'main') {
    const response = await fetch(this.headerURL(branch))
    // console.log('rest getHeader', response.constructor.name)
    if (!response.ok) return null
    const got = await response.json()
    // console.log('rest getHeader', got)
    return got
  }

  async writeHeader (branch, header) {
    if (this.config.readonly) return
    const pHeader = this.prepareHeader(header)
    // console.log('writeHeader rt', branch, pHeader)

    const response = await fetch(this.headerURL(branch), {
      method: 'PUT',
      body: pHeader,
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`An error occurred: ${response.statusText}`)
  }
}
