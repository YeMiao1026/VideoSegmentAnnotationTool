const fs = require('fs')
const puppeteer = require('puppeteer')

;(async () => {
  const log = []
  function L(...args){
    const s = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    console.log(s)
    log.push(s)
  }

  const headlessFlag = (process.env.HEADLESS === 'false') ? false : true
  const browser = await puppeteer.launch({ headless: headlessFlag, args: ['--no-sandbox','--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)

  // collect console messages
  page.on('console', msg => {
    L('[page.console]', msg.type(), msg.text())
  })

  // collect page errors
  page.on('pageerror', err => {
    L('[page.error]', err.toString())
  })

  // collect network responses
  const net = []
  page.on('response', async resp => {
    try {
      const url = resp.url()
      const status = resp.status()
      if (url.includes('/api/download-clip')) {
        // for 200 (binary) log headers; for non-200 read body text to get error message
        if (status === 200) {
          const ct = resp.headers()['content-type'] || ''
          const cl = resp.headers()['content-length'] || ''
          L('[network.response]', status, url, 'content-type=' + ct, 'content-length=' + cl)
          net.push({url,status,contentType:ct,contentLength:cl})
        } else {
          let txt = ''
          try { txt = await resp.text() } catch(e){ txt = '[resp.text.error] '+e.toString() }
          L('[network.response]', status, url, txt)
          net.push({url,status,body:txt})
        }
      }
    } catch(e){ L('[resp.err]', e.toString()) }
  })

  // collect network requests as well (so we can see the request details)
  page.on('request', req => {
    try {
      const url = req.url()
      const method = req.method()
      const postData = req.postData()
      if (url.includes('/api/download-clip')) {
        L('[network.request]', method, url, postData ? postData : '')
      }
    } catch(e){ L('[req.err]', e.toString()) }
  })

  try {
    const base = 'http://localhost:5174/'
    L('goto', base)
    await page.goto(base, { waitUntil: 'networkidle2' })

    // fill YouTube url
    const yt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    L('fill url', yt)
    const urlSelector = 'input[placeholder="YouTube 連結"]'
    await page.waitForSelector(urlSelector)
    await page.click(urlSelector, { clickCount: 3 })
    await page.type(urlSelector, yt)

    // fill start and end
    await page.evaluate(()=>{
      const inputs = Array.from(document.querySelectorAll('input'))
      // assume second and third inputs are start/end
      if(inputs.length >= 3){ inputs[1].value = '30'; inputs[1].dispatchEvent(new Event('input',{bubbles:true})); inputs[2].value = '35'; inputs[2].dispatchEvent(new Event('input',{bubbles:true})); }
    })

    // ensure the input actually contains the URL before clicking 載入/預覽
    // click 載入/預覽 (we type the url then click immediately)
    L('click load button')
    await page.evaluate(()=>{
      const buttons = Array.from(document.querySelectorAll('button'))
      const btn = buttons.find(b => b.textContent && b.textContent.includes('載入')) || buttons[0]
      if(btn) btn.click()
    })
    // give the player a short moment to initialize
    await new Promise(r => setTimeout(r, 1500))

  // wait a short moment for the player to initialize (don't require iframe selector,
  // iframe loading can be slow or blocked in headless environments)
  L('wait short for player init')
  await new Promise(r => setTimeout(r, 1500))

    // click first tag button
    L('click first tag button')
    await page.evaluate(()=>{
      const tag = document.querySelector('.tag-btn')
      if(tag) tag.click()
    })

    // click 下載此片段
    L('click download button')
    // intercept the axios network by clicking
    await page.evaluate(()=>{
      const buttons = Array.from(document.querySelectorAll('button'))
      const dl = buttons.find(b => b.textContent && b.textContent.includes('下載'))
      if(dl) dl.click()
    })

    // wait for network response to /api/download-clip
    L('wait for download response (10s)')
    const start = Date.now()
    while(Date.now() - start < 10000){
      if(net.find(n=> n.url.includes('/api/download-clip'))) break
      await new Promise(r=>setTimeout(r,200))
    }

    L('network events:', net)

  } catch (err) {
    L('[script.error]', err.stack || err.toString())
  } finally {
    try{ await browser.close() }catch(e){ /*ignore*/ }
    const out = log.join('\n')
    fs.writeFileSync('puppeteer_log.txt', out)
    console.log('\n--- TEST LOG ---\n' + out)
  }
})()
