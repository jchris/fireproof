import { before, describe, it } from 'mocha'
import assert from 'node:assert'
import { Valet } from '../src/valet.js'

describe('new Valet', () => {
  let val
  const calls = []

  before(async () => {
    val = new Valet('test')
    val.uploadFunction = async (carCid, value) => {
      calls.push({ carCid, value })
    }
  })
  it('has default attributes', async () => {
    assert(val.getValetBlock)
    assert(val.parkCar)
  })
  it('can park a car and serve the blocks', async () => {
    await val
      .parkCar('carCid', carBytes, [
        'bafyreifwghknmzabvgearl72url3v5leqqhtafvybcsrceelc3psqkocoi',
        'bafyreieth2ckopwivda5mf6vu76xwqvox3q5wsaxgbmxy2dgrd4hfuzmma'
      ])
      .then((car) => {
        assert('car parked')
        return val.getValetBlock('bafyreieth2ckopwivda5mf6vu76xwqvox3q5wsaxgbmxy2dgrd4hfuzmma').then((block) => {
          assert.equal(block.length, 300)
          return val.loader.getCarCIDForCID('bafyreieth2ckopwivda5mf6vu76xwqvox3q5wsaxgbmxy2dgrd4hfuzmma').then(({ result }) => {
            assert.equal(result, 'carCid')
          })
        })
      })
  })
  it('calls the upload function', () => {
    assert.equal(calls.length, 1)
    assert.equal(calls[0].carCid, 'carCid')
  })
})

const carBytes = new Uint8Array([
  58, 162, 101, 114, 111, 111, 116, 115, 129, 216, 42, 88, 37, 0, 1, 113, 18, 32, 147, 62, 132, 167, 62, 200, 168, 193,
  214, 23, 213, 167, 253, 123, 66, 174, 190, 225, 219, 72, 23, 48, 89, 124, 104, 102, 136, 248, 114, 211, 44, 96, 103,
  118, 101, 114, 115, 105, 111, 110, 1, 108, 1, 113, 18, 32, 182, 49, 212, 214, 100, 1, 169, 136, 8, 175, 250, 164, 87,
  186, 245, 100, 132, 15, 48, 22, 184, 8, 165, 17, 16, 139, 22, 223, 40, 41, 194, 114, 162, 100, 108, 101, 97, 102, 129,
  130, 120, 36, 49, 101, 102, 51, 98, 51, 50, 97, 45, 51, 99, 51, 97, 45, 52, 98, 53, 101, 45, 57, 99, 49, 99, 45, 56,
  99, 53, 99, 48, 99, 53, 99, 48, 99, 53, 99, 162, 99, 97, 103, 101, 24, 42, 100, 110, 97, 109, 101, 101, 97, 108, 105,
  99, 101, 102, 99, 108, 111, 115, 101, 100, 244, 208, 2, 1, 113, 18, 32, 147, 62, 132, 167, 62, 200, 168, 193, 214, 23,
  213, 167, 253, 123, 66, 174, 190, 225, 219, 72, 23, 48, 89, 124, 104, 102, 136, 248, 114, 211, 44, 96, 162, 100, 100,
  97, 116, 97, 164, 99, 107, 101, 121, 120, 36, 49, 101, 102, 51, 98, 51, 50, 97, 45, 51, 99, 51, 97, 45, 52, 98, 53,
  101, 45, 57, 99, 49, 99, 45, 56, 99, 53, 99, 48, 99, 53, 99, 48, 99, 53, 99, 100, 114, 111, 111, 116, 163, 99, 99,
  105, 100, 216, 42, 88, 37, 0, 1, 113, 18, 32, 182, 49, 212, 214, 100, 1, 169, 136, 8, 175, 250, 164, 87, 186, 245,
  100, 132, 15, 48, 22, 184, 8, 165, 17, 16, 139, 22, 223, 40, 41, 194, 114, 101, 98, 121, 116, 101, 115, 88, 72, 162,
  100, 108, 101, 97, 102, 129, 130, 120, 36, 49, 101, 102, 51, 98, 51, 50, 97, 45, 51, 99, 51, 97, 45, 52, 98, 53, 101,
  45, 57, 99, 49, 99, 45, 56, 99, 53, 99, 48, 99, 53, 99, 48, 99, 53, 99, 162, 99, 97, 103, 101, 24, 42, 100, 110, 97,
  109, 101, 101, 97, 108, 105, 99, 101, 102, 99, 108, 111, 115, 101, 100, 244, 101, 118, 97, 108, 117, 101, 162, 100,
  108, 101, 97, 102, 129, 130, 120, 36, 49, 101, 102, 51, 98, 51, 50, 97, 45, 51, 99, 51, 97, 45, 52, 98, 53, 101, 45,
  57, 99, 49, 99, 45, 56, 99, 53, 99, 48, 99, 53, 99, 48, 99, 53, 99, 162, 99, 97, 103, 101, 24, 42, 100, 110, 97, 109,
  101, 101, 97, 108, 105, 99, 101, 102, 99, 108, 111, 115, 101, 100, 244, 100, 116, 121, 112, 101, 99, 112, 117, 116,
  101, 118, 97, 108, 117, 101, 162, 99, 97, 103, 101, 24, 42, 100, 110, 97, 109, 101, 101, 97, 108, 105, 99, 101, 103,
  112, 97, 114, 101, 110, 116, 115, 128
])
