import test from 'ava'
import {Application} from 'spectron'
import os from 'os'
import path from 'path'
import fs from 'fs'
import tempy from 'tempy'
import electron from '../node_modules/electron'

import * as browserdriver from './lib/browser-driver'
import { shareDat } from './lib/dat-helpers'

const app = new Application({
  path: electron,
  args: ['../app'],
  env: {
    NODE_ENV: 'test',
    beaker_no_welcome_tab: 1,
    beaker_user_data_path: fs.mkdtempSync(os.tmpdir() + path.sep + 'beaker-test-'),
    beaker_dat_quota_default_bytes_allowed: 1024 * 10 // 10kb
  }
})
var testStaticDat, testStaticDatURL
var createdDatURL // url of the dat which is created by testRunnerDat, which gives it write access
var createdDatKey

test.before(async t => {
  // open the window
  await app.start()
  await app.client.waitUntilWindowLoaded()

  // share the test static dat
  testStaticDat = await shareDat(__dirname + '/scaffold/test-static-dat')
  testStaticDatURL = 'dat://' + testStaticDat.archive.key.toString('hex') + '/'

  // create a owned archive
  var res = await app.client.executeAsync((done) => {
    DatArchive.create({title: 'Test Archive', description: 'Is temporary', type: ['foo', 'bar']}).then(done,done)
  })
  createdDatURL = res.value.url
  createdDatKey = createdDatURL.slice('dat://'.length)

  // open the default start page
  await app.client.windowByIndex(1)
  await app.client.waitForExist('body > *')
})
test.after.always('cleanup', async t => {
  console.log(JSON.stringify(await app.client.getMainProcessLogs(), null, 2))
  await app.stop()
})

// tests
//

test('library.add, library.remove', async t => {
  // register event listeners
  await app.client.execute(() => {
    window.stats = {
      adds: 0,
      removes: 0
    }
    window.beaker.archives.addEventListener('added', event => {
      window.stats.adds++
    })
    window.beaker.archives.addEventListener('removed', event => {
      window.stats.removes++
    })
  })

  // by url
  var res = await app.client.executeAsync((url, done) => {
    window.beaker.archives.add(url).then(done,done)
  }, createdDatURL)
  t.deepEqual(res.value.isSaved, true)
  var res = await app.client.executeAsync((url, done) => {
    window.beaker.archives.remove(url, {noPrompt: true}).then(done,done)
  }, createdDatURL)
  t.deepEqual(res.value.isSaved, false)

  // by key
  var res = await app.client.executeAsync((key, done) => {
    window.beaker.archives.add(key).then(done,done)
  }, createdDatKey)
  t.deepEqual(res.value.isSaved, true)
  var res = await app.client.executeAsync((key, done) => {
    window.beaker.archives.remove(key, {noPrompt: true}).then(done,done)
  }, createdDatKey)
  t.deepEqual(res.value.isSaved, false)

  // check stats
  var stats = await app.client.execute(() => { return window.stats })
  t.deepEqual(stats.value, {
    adds: 2,
    removes: 2
  })
})

test('library.list', async t => {
  // add the owned and unowned dats
  var res = await app.client.executeAsync((url, done) => {
    window.beaker.archives.add(url).then(done,done)
  }, createdDatURL)
  t.deepEqual(res.value.isSaved, true)
  var res = await app.client.executeAsync((url, done) => {
    window.beaker.archives.add(url).then(done,done)
  }, testStaticDatURL)
  t.deepEqual(res.value.isSaved, true)

  // list all
  var res = await app.client.executeAsync((done) => {
    window.beaker.archives.list().then(done,done)
  })
  var items = res.value
  t.deepEqual(items.length, 3)
  t.deepEqual(items[0].userSettings.isSaved, true)
  t.deepEqual(items[1].userSettings.isSaved, true)
  t.deepEqual(items[0].userSettings.autoDownload, true)
  t.deepEqual(items[1].userSettings.autoDownload, true)
  t.deepEqual(items.filter(i => i.isOwner).length, 2)

  // list owned
  var res = await app.client.executeAsync((done) => {
    window.beaker.archives.list({ isOwner: true }).then(done,done)
  })
  t.deepEqual(res.value.length, 2)

  // list unowned
  var res = await app.client.executeAsync((done) => {
    window.beaker.archives.list({ isOwner: false }).then(done,done)
  })
  t.deepEqual(res.value.length, 1)

  // list by type
  var res = await app.client.executeAsync((done) => {
    window.beaker.archives.list({ type: 'foo' }).then(done,done)
  })
  t.deepEqual(res.value.length, 1)
  var res = await app.client.executeAsync((done) => {
    window.beaker.archives.list({ type: 'bar' }).then(done,done)
  })
  t.deepEqual(res.value.length, 1)
  var res = await app.client.executeAsync((done) => {
    window.beaker.archives.list({ type: 'baz' }).then(done,done)
  })
  t.deepEqual(res.value.length, 0)

})

test('publishing', async t => {
  // publish by url
  var res = await app.client.executeAsync((url, done) => {
    window.beaker.archives.publish(url).then(done,done)
  }, createdDatURL)
  var recordUrl = res.value
  t.truthy(recordUrl.startsWith('dat://'))
  var res = await app.client.executeAsync((recordUrl, done) => {
    window.beaker.archives.getPublishRecord(recordUrl).then(done,done)
  }, recordUrl)
  var cmp = {
    _origin: res.value._origin,
    _url: res.value._url,
    createdAt: res.value.createdAt,
    description: 'Is temporary',
    id: res.value.id,
    receivedAt: res.value.receivedAt,
    title: 'Test Archive',
    type: [ 'foo', 'bar' ],
    url: createdDatURL,
    votes: { currentUsersVote: 0, down: 0, up: 0, upVoters: [], value: 0 }
  }
  t.deepEqual(res.value, cmp)

  // list
  var res = await app.client.executeAsync((done) => {
    window.beaker.archives.listPublished({fetchAuthor: true, countVotes: true}).then(done,done)
  })
  t.deepEqual(res.value, [
    { _origin: res.value[0]._origin,
    _url: res.value[0]._url,
    createdAt: res.value[0].createdAt,
    description: 'Is temporary',
    id: res.value[0].id,
    receivedAt: res.value[0].receivedAt,
    title: 'Test Archive',
    type: [ 'foo', 'bar' ],
    url: createdDatURL,
    votes: { currentUsersVote: 0, down: 0, up: 0, upVoters: [], value: 0 } }
  ])

  // unpublish by url
  await app.client.executeAsync((url, done) => {
    window.beaker.archives.unpublish(url).then(done,done)
  }, createdDatURL)
  var res = await app.client.executeAsync((recordUrl, done) => {
    window.beaker.archives.getPublishRecord(recordUrl).then(done,done)
  }, recordUrl)
  t.falsy(res.value)

  // publish/unpublish by archive
  var res = await app.client.executeAsync((url, done) => {
    var archive = new DatArchive(url)
    window.beaker.archives.publish(archive).then(done,done)
  }, createdDatURL)
  var recordUrl = res.value
  t.truthy(recordUrl.startsWith('dat://'))
  var res = await app.client.executeAsync((recordUrl, done) => {
    window.beaker.archives.getPublishRecord(recordUrl).then(done,done)
  }, recordUrl)
  t.deepEqual(res.value, {
    _origin: res.value._origin,
    _url: res.value._url,
    createdAt: res.value.createdAt,
    description: 'Is temporary',
    id: res.value.id,
    receivedAt: res.value.receivedAt,
    title: 'Test Archive',
    type: [ 'foo', 'bar' ],
    url: createdDatURL,
    votes: { currentUsersVote: 0, down: 0, up: 0, upVoters: [], value: 0 }
  })
  await app.client.executeAsync((url, done) => {
    var archive = new DatArchive(url)
    window.beaker.archives.unpublish(archive).then(done,done)
  }, createdDatURL)
  var res = await app.client.executeAsync((recordUrl, done) => {
    window.beaker.archives.getPublishRecord(recordUrl).then(done,done)
  }, recordUrl)
  t.falsy(res.value)
})

test('library "updated" event', async t => {
  // register event listener
  await app.client.execute(() => {
    window.newTitle = false
    window.beaker.archives.addEventListener('updated', event => {
      window.newTitle = event.details.title
    })
  })

  // update manifest
  var res = await app.client.executeAsync((url, done) => {
    (new DatArchive(url)).configure({ title: 'The New Title' }).then(done, done)
  }, createdDatURL)

  // check result
  await app.client.waitUntil(() => {
    return app.client.execute(() => { return !!window.newTitle }).then(res => res.value)
  }, 5e3)
  var res = await app.client.execute(() => { return window.newTitle })
  t.deepEqual(res.value, 'The New Title')
})


function sleep (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}
