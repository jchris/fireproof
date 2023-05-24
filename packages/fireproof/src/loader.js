import { Browser } from './storage/browser.js'
// import { Filesystem } from './storage/filesystem.js'
import { Rest } from './storage/rest.js'

const FORCE_IDB = typeof process !== 'undefined' && !!process.env?.FORCE_IDB

/* global window */

export const Loader = {
  appropriate: (name, config = {}) => {
    let isBrowser = false
    try {
      isBrowser = window.localStorage && true
    } catch (e) {}

    if (config.type === 'rest') {
      return new Rest(name, config)
    }

    if (FORCE_IDB || isBrowser) {
      return new Browser(name, config)
    } else {
      return new Browser(name, config)
      // return new Filesystem(name, config)
    }
  }
}
