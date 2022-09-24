import jsSHA from 'jssha'

// imageProxy is a helper function that converts images into a proxy format
export enum resizeOptions {
  fit = 'fit',
  fill = 'fill',
  auto = 'auto'
}

export enum gravityOptions {
  no = 'no',
  so = 'so',
  ea = 'ea',
  we = 'we',
  ce = 'ce',
  sm = 'sm'
}

export enum extensionOptions {
  jpg = 'jpg',
  png = 'png',
  webp = 'webp'
}

interface ProxyOption {
  url: string
  resize: resizeOptions
  width: number
  height: number
  gravity: gravityOptions
  enlarge: boolean
  extension: extensionOptions
  key: string
  salt: string
  proxyUrl: string
}

const hex2a = (hexx: any): string => {
  const hex = hexx.toString()
  let str = ''
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }
  return str
}

// URL generator logic
export const generateProxyUrl = (opts: ProxyOption): string => {
  const encoded_url = Buffer.from(opts.url).toString('base64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-')
  const path = '/rs:' + opts.resize + ':' + opts.width + ':' + opts.height + ':' + Number(opts.enlarge) +
    '/g:' + opts.gravity  + '/' + encoded_url + '.' + opts.extension
  const shaObj = new jsSHA('SHA-256', 'BYTES')
  shaObj.setHMACKey(opts.key, 'HEX')
  shaObj.update(hex2a(opts.salt))
  shaObj.update(path)
  const hmac = shaObj.getHMAC('B64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-')
  return opts.proxyUrl + '/' + hmac + path
}