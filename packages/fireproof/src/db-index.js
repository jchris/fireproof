import { create, load } from 'prolly-trees/db-index'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { nocache as cache } from 'prolly-trees/cache'
import { bf, simpleCompare } from 'prolly-trees/utils'
import { makeGetBlock } from './prolly.js'
import { cidsToProof } from './fireproof.js'
import * as codec from '@ipld/dag-cbor'
// import { create as createBlock } from 'multiformats/block'
import { doTransaction } from './blockstore.js'
import charwise from 'charwise'

const ALWAYS_REBUILD = true // todo: remove this

const arrayCompare = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      const comp = simpleCompare(a[i], b[i])
      if (comp !== 0) {
        return comp
      }
    }
    return simpleCompare(a.length, b.length)
  } else {
    return simpleCompare(a, b)
  }
}

const compare = (a, b) => {
  const [aKey, aRef] = a
  const [bKey, bRef] = b
  const comp = simpleCompare(aKey, bKey)
  if (comp !== 0) return comp
  return refCompare(aRef, bRef)
}

const refCompare = (aRef, bRef) => {
  if (Number.isNaN(aRef)) return -1
  if (Number.isNaN(bRef)) throw new Error('ref may not be Infinity or NaN')
  if (!Number.isFinite(aRef)) return 1
  // if (!Number.isFinite(bRef)) throw new Error('ref may not be Infinity or NaN')
  return simpleCompare(aRef, bRef)
}

const opts = { cache, chunker: bf(3), codec, hasher, compare }

const makeDoc = ({ key, value }) => ({ _id: key, ...value })

/**
 * JDoc for the result row type.
 * @typedef {Object} ChangeEvent
 * @property {string} key - The key of the document.
 * @property {Object} value - The new value of the document.
 * @property {boolean} [del] - Is the row deleted?
 * @memberof DbIndex
 */

/**
 * JDoc for the result row type.
 * @typedef {Object} DbIndexEntry
 * @property {string[]} key - The key for the DbIndex entry.
 * @property {Object} value - The value of the document.
 * @property {boolean} [del] - Is the row deleted?
 * @memberof DbIndex
 */

/**
 * Transforms a set of changes to DbIndex entries using a map function.
 *
 * @param {ChangeEvent[]} changes
 * @param {Function} mapFun
 * @returns {DbIndexEntry[]} The DbIndex entries generated by the map function.
 * @private
 * @memberof DbIndex
 */
const indexEntriesForChanges = (changes, mapFun) => {
  const indexEntries = []
  changes.forEach(({ key, value, del }) => {
    if (del || !value) return
    mapFun(makeDoc({ key, value }), (k, v) => {
      indexEntries.push({
        key: [charwise.encode(k), key],
        value: v
      })
    })
  })
  return indexEntries
}

const indexEntriesForOldChanges = async (blocks, byIDindexRoot, ids, mapFun) => {
  const { getBlock } = makeGetBlock(blocks)
  const byIDindex = await load({ cid: byIDindexRoot.cid, get: getBlock, ...opts })

  const result = await byIDindex.getMany(ids)
  return result
}

/**
 * Represents an DbIndex for a Fireproof database.
 *
 * @class DbIndex
 * @classdesc An DbIndex can be used to order and filter the documents in a Fireproof database.
 *
 * @param {Fireproof} database - The Fireproof database instance to DbIndex.
 * @param {Function} mapFun - The map function to apply to each entry in the database.
 *
 */
export default class DbIndex {
  constructor (database, mapFun) {
    /**
     * The database instance to DbIndex.
     * @type {Fireproof}
     */
    this.database = database
    /**
     * The map function to apply to each entry in the database.
     * @type {Function}
     */
    this.mapFun = mapFun

    this.dbIndexRoot = null
    this.dbIndex = null

    this.byIDindexRoot = null
    this.dbHead = null
  }

  /**
   * JSDoc for Query type.
   * @typedef {Object} DbQuery
   * @property {string[]} [range] - The range to query.
   * @memberof DbIndex
   */

  /**
   * Query object can have {range}
   * @param {DbQuery} query - the query range to use
   * @returns {Promise<{rows: Array<{id: string, key: string, value: any}>}>}
   * @memberof DbIndex
   * @instance
   */
  async query (query) {
    // if (!root) {
    // pass a root to query a snapshot
    await doTransaction('#updateIndex', this.database.blocks, async (blocks) => {
      await this.#updateIndex(blocks)
    })
    // }
    const response = await doIndexQuery(this.database.blocks, this.dbIndexRoot, this.dbIndex, query)
    return {
      proof: { index: await cidsToProof(response.cids) },
      // TODO fix this naming upstream in prolly/db-DbIndex?
      rows: response.result.map(({ id, key, row }) => {
        // console.log('query', id, key, row)
        return ({ id, key: charwise.decode(key), value: row })
      })
    }
  }

  /**
   * Update the DbIndex with the latest changes
   * @private
   * @returns {Promise<void>}
   */
  async #updateIndex (blocks) {
    // todo remove this hack
    if (ALWAYS_REBUILD) {
      this.dbHead = null // hack
      this.dbIndex = null // hack
      this.dbIndexRoot = null
    }
    const result = await this.database.changesSince(this.dbHead) // {key, value, del}
    if (this.dbHead) {
      const oldChangeEntries = await indexEntriesForOldChanges(
        blocks,
        this.byIDindexRoot,
        result.rows.map(({ key }) => key),
        this.mapFun
      )
      const oldIndexEntries = oldChangeEntries.result.map((key) => ({ key, del: true }))
      const removalResult = await bulkIndex(blocks, this.dbIndexRoot, this.dbIndex, oldIndexEntries, opts)
      this.dbIndexRoot = removalResult.root
      this.dbIndex = removalResult.dbIndex

      const removeByIdIndexEntries = oldIndexEntries.map(({ key }) => ({ key: key[1], del: true }))
      const purgedRemovalResults = await bulkIndex(
        blocks,
        this.byIDindexRoot,
        this.byIDIndex,
        removeByIdIndexEntries,
        opts
      )
      this.byIDindexRoot = purgedRemovalResults.root
      this.byIDIndex = purgedRemovalResults.dbIndex
    }
    const indexEntries = indexEntriesForChanges(result.rows, this.mapFun)
    const byIdIndexEntries = indexEntries.map(({ key }) => ({ key: key[1], value: key }))
    const addFutureRemovalsResult = await bulkIndex(blocks, this.byIDindexRoot, this.byIDIndex, byIdIndexEntries, opts)
    this.byIDindexRoot = addFutureRemovalsResult.root
    this.byIDIndex = addFutureRemovalsResult.dbIndex

    // console.log('indexEntries', indexEntries)

    const updateIndexResult = await bulkIndex(blocks, this.dbIndexRoot, this.dbIndex, indexEntries, opts)
    this.dbIndexRoot = updateIndexResult.root
    this.dbIndex = updateIndexResult.dbIndex

    this.dbHead = result.clock
  }
}

/**
 * Update the DbIndex with the given entries
 * @param {Blockstore} blocks
 * @param {Block} inRoot
 * @param {DbIndexEntry[]} indexEntries
 * @private
 */
async function bulkIndex (blocks, inRoot, inDBindex, indexEntries) {
  if (!indexEntries.length) return { dbIndex: inDBindex, root: inRoot }
  const putBlock = blocks.put.bind(blocks)
  const { getBlock } = makeGetBlock(blocks)
  let returnRootBlock
  let returnNode
  if (!inDBindex) {
    for await (const node of await create({ get: getBlock, list: indexEntries, ...opts })) {
      const block = await node.block
      await putBlock(block.cid, block.bytes)
      returnRootBlock = block
      returnNode = node
    }
  } else {
    // const dbIndex = await load({ cid: inRoot.cid, get: getBlock, ...opts }) // todo load from root on refresh
    const { root, blocks } = await inDBindex.bulk(indexEntries)
    returnRootBlock = await root.block
    returnNode = root
    for await (const block of blocks) {
      await putBlock(block.cid, block.bytes)
    }
    await putBlock(returnRootBlock.cid, returnRootBlock.bytes)
  }
  return { dbIndex: returnNode, root: returnRootBlock }
}

async function doIndexQuery (blocks, dbIndexRoot, dbIndex, query) {
  if (!dbIndex) {
    const cid = dbIndexRoot && dbIndexRoot.cid
    if (!cid) return { result: [] }
    const { getBlock } = makeGetBlock(blocks)
    dbIndex = await load({ cid, get: getBlock, ...opts })
  }
  if (query.range) {
    const encodedRange = query.range.map((key) => charwise.encode(key))
    return dbIndex.range(...encodedRange)
  } else if (query.key) {
    const encodedKey = charwise.encode(query.key)
    console.log('getting key', encodedKey)
    return dbIndex.get(encodedKey)
  }
}
