import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nagCopy } from '../src/app/nagCopy.ts'
import {
  NAG_WINDOW_MS,
  dismissId,
  findSoonBlock,
  isStartingSoon,
  pickStartingSoonLine,
  readDismissed,
  writeDismissed,
  type NagBlock,
} from '../src/app/nagBanner.ts'

const now = new Date('2026-11-17T15:00:00.000Z')

function block(id: string, start: Date, title = id): NagBlock {
  return { _id: id, title, start: start.toISOString() }
}

function minutesFromNow(minutes: number) {
  return new Date(now.getTime() + minutes * 60_000)
}

test('a block starting in 15 minutes or less is starting soon, but not one that already started', () => {
  assert.equal(isStartingSoon(block('a', minutesFromNow(15)), now), true)
  assert.equal(isStartingSoon(block('b', minutesFromNow(1)), now), true)
  assert.equal(isStartingSoon(block('c', minutesFromNow(15.01)), now), false)
  assert.equal(isStartingSoon(block('d', minutesFromNow(0)), now), false)
  assert.equal(isStartingSoon(block('e', minutesFromNow(-1)), now), false)
  assert.equal(NAG_WINDOW_MS, 15 * 60 * 1000)
})

test('the banner picks the soonest undismissed block in the window', () => {
  const later = block('later', minutesFromNow(12), 'Later')
  const sooner = block('sooner', minutesFromNow(5), 'Sooner')
  const tooFar = block('far', minutesFromNow(20), 'Far')
  assert.equal(findSoonBlock([later, sooner, tooFar], now, new Set()), sooner)
  assert.equal(findSoonBlock([later, sooner], now, new Set([dismissId(sooner)])), later)
  assert.equal(findSoonBlock([later, sooner], now, new Set([dismissId(sooner), dismissId(later)])), null)
  assert.equal(findSoonBlock([], now, new Set()), null)
})

test('the starting-soon line comes from nagCopy and is stable for a block', () => {
  const line = pickStartingSoonLine({ _id: 'abc' })
  assert.ok(nagCopy.startingSoon.includes(line))
  assert.equal(pickStartingSoonLine({ _id: 'abc' }), line)
})

test('dismissed ids round-trip through storage', () => {
  const store: Record<string, string> = {}
  const storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
  }
  assert.deepEqual([...readDismissed(storage)], [])
  writeDismissed(storage, new Set(['id:start']))
  assert.deepEqual([...readDismissed(storage)], ['id:start'])
})

test('corrupt storage is treated as nothing dismissed', () => {
  const storage = { getItem: () => 'not-json', setItem: () => {} }
  assert.deepEqual([...readDismissed(storage)], [])
})
